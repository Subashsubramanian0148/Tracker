// Grants "Key Vault Secrets User" on individual secrets (not the whole vault), so each workload
// identity can read exactly the secrets it consumes. The secrets must already exist.

param keyVaultName string
param secretNames array
param principalId string

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource secrets 'Microsoft.KeyVault/vaults/secrets@2023-07-01' existing = [
  for secretName in secretNames: {
    parent: vault
    name: secretName
  }
]

var secretsUserRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')

resource assignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for (secretName, i) in secretNames: {
    name: guid(vault.id, secretName, principalId, secretsUserRoleId)
    scope: secrets[i]
    properties: {
      roleDefinitionId: secretsUserRoleId
      principalId: principalId
      principalType: 'ServicePrincipal'
    }
  }
]
