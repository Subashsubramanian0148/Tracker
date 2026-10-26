@description('Key Vault name: 3-24 characters, globally unique.')
param name string

param location string
param tags object

@description('Protect against accidental deletion with a CanNotDelete lock.')
param enableDeleteLock bool = true

param tenantId string
param logAnalyticsWorkspaceId string
param privateEndpointSubnetId string
param privateDnsZoneId string

@description('Public IPv4 ranges (CIDR) allowed to reach the data plane, e.g. an operator egress IP while secrets are seeded. Empty = public network access disabled (private endpoint only).')
param allowedIpRanges array = []

@description('Principal IDs (users or groups) granted Key Vault Secrets Officer to set secret values out-of-band.')
param secretsOfficerPrincipalIds array = []

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: false
    publicNetworkAccess: empty(allowedIpRanges) ? 'Disabled' : 'Enabled'
    networkAcls: {
      defaultAction: 'Deny'
      bypass: 'None'
      ipRules: [
        for range in allowedIpRanges: {
          value: range
        }
      ]
      virtualNetworkRules: []
    }
  }
}

var secretsOfficerRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')

resource officerAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for principalId in secretsOfficerPrincipalIds: {
    name: guid(vault.id, principalId, secretsOfficerRoleId)
    scope: vault
    properties: {
      roleDefinitionId: secretsOfficerRoleId
      principalId: principalId
    }
  }
]

module privateEndpoint 'private-endpoint.bicep' = {
  name: '${name}-pe'
  params: {
    name: '${name}-pe'
    location: location
    tags: tags
    subnetId: privateEndpointSubnetId
    privateLinkServiceId: vault.id
    groupId: 'vault'
    privateDnsZoneId: privateDnsZoneId
  }
}

resource deleteLock 'Microsoft.Authorization/locks@2020-05-01' = if (enableDeleteLock) {
  name: 'do-not-delete'
  scope: vault
  properties: {
    level: 'CanNotDelete'
    notes: 'Holds audit-relevant data (2-year retention). Remove the lock deliberately before decommissioning.'
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: vault
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
  }
}

output id string = vault.id
output name string = vault.name
output uri string = vault.properties.vaultUri
