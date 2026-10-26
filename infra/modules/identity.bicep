param prefix string
param location string
param tags object

@description('GitHub repository (owner/name) allowed to deploy through OIDC. Empty = no deployer identity is created.')
param githubRepository string = ''

@description('GitHub environment name whose jobs may use the deployer identity (OIDC subject repo:<repo>:environment:<name>).')
param githubEnvironment string = ''

var createDeployer = !empty(githubRepository) && !empty(githubEnvironment)

// Runtime identity of the app: pulls images, reads its Key Vault secrets, calls Azure DevOps,
// receives from the change queue.
resource app 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-id-app'
  location: location
  tags: tags
}

// Identity of the migration job: pulls images and reads only the migrator database secret.
// Kept separate so the long-running app never holds DDL-capable database credentials.
resource migrator 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-id-migrator'
  location: location
  tags: tags
}

// CI/CD identity (no client secret): GitHub Actions exchanges its OIDC token for an Entra token.
resource deployer 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (createDeployer) {
  name: '${prefix}-id-deploy'
  location: location
  tags: tags
}

resource deployerFederation 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (createDeployer) {
  parent: deployer
  name: 'github-${githubEnvironment}'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepository}:environment:${githubEnvironment}'
    audiences: ['api://AzureADTokenExchange']
  }
}

output appIdentityId string = app.id
output appIdentityName string = app.name
output appIdentityClientId string = app.properties.clientId
output appIdentityPrincipalId string = app.properties.principalId
output migratorIdentityId string = migrator.id
output migratorIdentityClientId string = migrator.properties.clientId
output migratorIdentityPrincipalId string = migrator.properties.principalId
output deployerClientId string = createDeployer ? deployer.properties.clientId : ''
output deployerPrincipalId string = createDeployer ? deployer.properties.principalId : ''
