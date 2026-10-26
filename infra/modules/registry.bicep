@description('Registry name: 5-50 alphanumeric characters, globally unique.')
param name string

param location string
param tags object
param logAnalyticsWorkspaceId string
param privateEndpointSubnetId string
param privateDnsZoneId string

@description('Principal IDs granted AcrPull (app and migrator identities).')
param pullPrincipalIds array

// Premium is required for private endpoints, export policy, and the trusted-services bypass used by
// `az acr import` (the CD pipeline imports images server-side, so no runner needs network access to ACR).
//
// Cost-saving alternative (list price ~USD 20/month vs ~50 for Premium): sku 'Standard' with
// publicNetworkAccess 'Enabled'. Standard has NO private endpoint and NO IP firewall (network rules are
// Premium-only), so access is gated only by Entra RBAC (admin user stays disabled). If you choose it,
// remove the private endpoint module and the exportPolicy below.
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Premium'
  }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    publicNetworkAccess: 'Disabled'
    networkRuleBypassOptions: 'AzureServices'
    dataEndpointEnabled: false
    zoneRedundancy: 'Disabled'
    policies: {
      exportPolicy: {
        status: 'disabled'
      }
      retentionPolicy: {
        status: 'enabled'
        days: 30
      }
      quarantinePolicy: {
        status: 'disabled'
      }
    }
  }
}

var acrPullRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')

resource pullAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for principalId in pullPrincipalIds: {
    name: guid(registry.id, principalId, acrPullRoleId)
    scope: registry
    properties: {
      roleDefinitionId: acrPullRoleId
      principalId: principalId
      principalType: 'ServicePrincipal'
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
    privateLinkServiceId: registry.id
    groupId: 'registry'
    privateDnsZoneId: privateDnsZoneId
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: registry
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

output id string = registry.id
output name string = registry.name
output loginServer string = registry.properties.loginServer
