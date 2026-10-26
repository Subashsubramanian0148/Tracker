param name string
param location string
param tags object

param environmentId string
param environmentName string

@description('User-assigned identity resource ID (image pull, Key Vault references, Azure DevOps, change queue).')
param identityId string

param registryLoginServer string
param keyVaultUri string

@description('Image reference, preferably by digest: <acr>.azurecr.io/ado-metrics/runtime@sha256:...')
param image string

@description('Plain environment variables: [{ name, value }].')
param environmentVariables array

@description('Environment variables sourced from Key Vault: [{ name: ENV_VAR, secretName: key-vault-secret-name }].')
param secretEnvironmentVariables array

param minReplicas int = 1
param maxReplicas int = 3
param cpu string = '0.5'
param memory string = '1Gi'

@description('Optional source CIDRs allowed through ingress (e.g. corporate VPN ranges). Empty = any address that can route to the internal environment.')
param allowedIngressCidrs array = []

@description('Optional custom domain, e.g. metrics.contoso.internal. Requires customDomainCertificateSecretUri.')
param customDomainName string = ''

@description('Key Vault secret URI (versionless) of the PFX certificate for the custom domain.')
param customDomainCertificateSecretUri string = ''

var useCustomDomain = !empty(customDomainName) && !empty(customDomainCertificateSecretUri)

resource environment 'Microsoft.App/managedEnvironments@2025-07-01' existing = {
  name: environmentName
}

resource certificate 'Microsoft.App/managedEnvironments/certificates@2025-07-01' = if (useCustomDomain) {
  parent: environment
  name: replace(customDomainName, '.', '-')
  location: location
  tags: tags
  properties: {
    certificateKeyVaultProperties: {
      identity: identityId
      keyVaultUrl: customDomainCertificateSecretUri
    }
  }
}

var secrets = [
  for item in secretEnvironmentVariables: {
    name: item.secretName
    keyVaultUrl: '${keyVaultUri}secrets/${item.secretName}'
    identity: identityId
  }
]

var secretEnv = [
  for item in secretEnvironmentVariables: {
    name: item.name
    secretRef: item.secretName
  }
]

var ipRestrictions = [
  for (cidr, i) in allowedIngressCidrs: {
    name: 'allow-${i}'
    action: 'Allow'
    ipAddressRange: cidr
  }
]

resource app 'Microsoft.App/containerApps@2025-07-01' = {
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
      activeRevisionsMode: 'Single'
      // Previous revisions are kept (inactive) for fast rollback.
      maxInactiveRevisions: 10
      ingress: {
        // In an INTERNAL environment "external" means reachable from the VNet (and peered/VPN networks)
        // through the environment's internal load balancer. There is no public endpoint. With
        // external=false the app would only be reachable from other apps in the same environment.
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
        clientCertificateMode: 'ignore'
        traffic: [
          {
            latestRevision: true
            weight: 100
          }
        ]
        ipSecurityRestrictions: ipRestrictions
        customDomains: useCustomDomain
          ? [
              {
                name: customDomainName
                certificateId: certificate.id
                bindingType: 'SniEnabled'
              }
            ]
          : []
      }
      registries: [
        {
          server: registryLoginServer
          identity: identityId
        }
      ]
      secrets: secrets
    }
    template: {
      terminationGracePeriodSeconds: 30
      containers: [
        {
          name: 'app'
          image: image
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: concat(environmentVariables, secretEnv)
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/api/health/live'
                port: 3000
              }
              initialDelaySeconds: 3
              periodSeconds: 5
              timeoutSeconds: 3
              failureThreshold: 24
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health/live'
                port: 3000
              }
              periodSeconds: 15
              timeoutSeconds: 3
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health/ready'
                port: 3000
              }
              periodSeconds: 10
              timeoutSeconds: 5
              failureThreshold: 3
              successThreshold: 1
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
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-concurrency'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output id string = app.id
output name string = app.name
output fqdn string = app.properties.configuration.ingress.fqdn
output latestRevisionName string = app.properties.latestRevisionName
