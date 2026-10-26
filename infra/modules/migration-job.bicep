// Manually triggered Container Apps Job that runs `prisma migrate deploy` (Dockerfile target: migrator).
// The CD pipeline updates the image and starts an execution before each app rollout.

param name string
param location string
param tags object
param environmentId string

@description('Migrator identity resource ID (image pull + its single Key Vault secret).')
param identityId string

param registryLoginServer string
param keyVaultUri string

@description('Key Vault secret holding the DDL-capable migrator connection string.')
param databaseUrlSecretName string

@description('Migrator image, preferably by digest.')
param image string

resource job 'Microsoft.App/jobs@2025-07-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 900
      // Migrations are not retried automatically: a failed migration needs a human decision.
      replicaRetryLimit: 0
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: registryLoginServer
          identity: identityId
        }
      ]
      secrets: [
        {
          name: databaseUrlSecretName
          keyVaultUrl: '${keyVaultUri}secrets/${databaseUrlSecretName}'
          identity: identityId
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'migrate'
          image: image
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'DATABASE_URL'
              secretRef: databaseUrlSecretName
            }
          ]
          volumeMounts: [
            {
              volumeName: 'tmp'
              mountPath: '/tmp'
            }
          ]
        }
      ]
      volumes: [
        {
          name: 'tmp'
          storageType: 'EmptyDir'
        }
      ]
    }
  }
}

output id string = job.id
output name string = job.name
