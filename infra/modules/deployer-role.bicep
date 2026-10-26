// Least-privilege custom role for the CI/CD identity, assigned at resource-group scope.
// It can import images into ACR, update the app/job image, start the migration job and read status.
// It cannot change networking, Key Vault, identities' role assignments, or the database.
//
// Note: permission to start a Container Apps Job (or to update an app) implies the ability to run a
// container with that workload's secrets and managed identity. Treat this identity as privileged,
// keep it bound to protected GitHub environments, and review its sign-in logs.

param prefix string
param principalId string

var roleName = '${prefix} deployer'

resource role 'Microsoft.Authorization/roleDefinitions@2022-04-01' = {
  name: guid(resourceGroup().id, roleName)
  properties: {
    roleName: roleName
    description: 'CD pipeline for ${prefix}: import images, roll out Container Apps revisions, run the migration job.'
    type: 'CustomRole'
    assignableScopes: [resourceGroup().id]
    permissions: [
      {
        actions: [
          'Microsoft.Resources/subscriptions/resourceGroups/read'
          'Microsoft.ContainerRegistry/registries/read'
          'Microsoft.ContainerRegistry/registries/importImage/action'
          'Microsoft.App/managedEnvironments/read'
          'Microsoft.App/managedEnvironments/join/action'
          'Microsoft.App/containerApps/read'
          'Microsoft.App/containerApps/write'
          'Microsoft.App/containerApps/revisions/read'
          'Microsoft.App/containerApps/revisions/replicas/read'
          'Microsoft.App/containerApps/revisions/activate/action'
          'Microsoft.App/containerApps/revisions/deactivate/action'
          // `az containerapp update` / `job update` read the existing secret definitions to send a full
          // template. With Key Vault references these are URIs, not secret values.
          'Microsoft.App/containerApps/listSecrets/action'
          'Microsoft.App/jobs/read'
          'Microsoft.App/jobs/write'
          'Microsoft.App/jobs/start/action'
          'Microsoft.App/jobs/listSecrets/action'
          'Microsoft.App/jobs/executions/read'
          'Microsoft.App/jobs/execution/read'
          'Microsoft.App/locations/*/read'
          'Microsoft.App/operations/read'
          // Required to (re)apply a template that references the user-assigned identities.
          'Microsoft.ManagedIdentity/userAssignedIdentities/read'
          'Microsoft.ManagedIdentity/userAssignedIdentities/assign/action'
        ]
        notActions: []
        dataActions: []
        notDataActions: []
      }
    ]
  }
}

resource assignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(resourceGroup().id, principalId, role.id)
  properties: {
    roleDefinitionId: role.id
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}

output roleDefinitionId string = role.id
