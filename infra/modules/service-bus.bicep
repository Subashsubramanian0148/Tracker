// Change queue on Azure Service Bus (default, CHANGE_QUEUE_KIND=servicebus).
//
// Azure DevOps service hooks run in the Azure DevOps cloud and must reach this namespace over its
// public endpoint, so public network access stays enabled. Exposure is limited by authorization:
//   - ADO sends with either an Azure Resource Manager service connection (Entra ID, granted
//     "Azure Service Bus Data Sender" on this queue only) or a queue-scoped SAS rule with Send rights
//     only. Neither can read, manage, or reach any other entity.
//   - The app receives with its managed identity ("Azure Service Bus Data Receiver" on this queue).

param name string
param location string
param tags object
param logAnalyticsWorkspaceId string

param queueName string

@allowed(['Standard', 'Premium'])
@description('Standard (~USD 10/month) has no private endpoint; app traffic goes to the public endpoint over TLS 1.2 with Entra auth. Premium (~USD 680/month per MU) adds a private endpoint for the app side.')
param sku string = 'Standard'

@description('Keep a queue-scoped Send-only SAS rule for the ADO service hook. Set false when ADO uses an ARM service connection; this also disables all SAS (local) auth on the namespace.')
param enableServiceHookSasRule bool = true

@description('Principal ID of the identity behind the ADO "Azure Resource Manager" service connection used by the service hook. Empty = not granted.')
param serviceHookSenderPrincipalId string = ''

@description('Principal ID of the app identity (receiver).')
param receiverPrincipalId string

param privateEndpointSubnetId string = ''
param privateDnsZoneId string = ''

resource namespace 'Microsoft.ServiceBus/namespaces@2024-01-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
    tier: sku
    capacity: sku == 'Premium' ? 1 : null
  }
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: !enableServiceHookSasRule
    zoneRedundant: sku == 'Premium'
  }
}

resource queue 'Microsoft.ServiceBus/namespaces/queues@2024-01-01' = {
  parent: namespace
  name: queueName
  properties: {
    lockDuration: 'PT1M'
    maxDeliveryCount: 10
    defaultMessageTimeToLive: 'P7D'
    deadLetteringOnMessageExpiration: true
    requiresDuplicateDetection: false
    requiresSession: false
    enablePartitioning: false
    maxSizeInMegabytes: 1024
  }
}

resource serviceHookSendRule 'Microsoft.ServiceBus/namespaces/queues/authorizationRules@2024-01-01' = if (enableServiceHookSasRule) {
  parent: queue
  name: 'ado-service-hook-send'
  properties: {
    rights: ['Send']
  }
}

var dataReceiverRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0')
var dataSenderRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39')

resource receiverAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(queue.id, receiverPrincipalId, dataReceiverRoleId)
  scope: queue
  properties: {
    roleDefinitionId: dataReceiverRoleId
    principalId: receiverPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource senderAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(serviceHookSenderPrincipalId)) {
  name: guid(queue.id, serviceHookSenderPrincipalId, dataSenderRoleId)
  scope: queue
  properties: {
    roleDefinitionId: dataSenderRoleId
    principalId: serviceHookSenderPrincipalId
    principalType: 'ServicePrincipal'
  }
}

module privateEndpoint 'private-endpoint.bicep' = if (sku == 'Premium' && !empty(privateDnsZoneId)) {
  name: '${name}-pe'
  params: {
    name: '${name}-pe'
    location: location
    tags: tags
    subnetId: privateEndpointSubnetId
    privateLinkServiceId: namespace.id
    groupId: 'namespace'
    privateDnsZoneId: privateDnsZoneId
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: namespace
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

output namespaceId string = namespace.id
output namespaceName string = namespace.name
output queueId string = queue.id
// Generic queue URL consumed by the app as CHANGE_QUEUE_URL: https://<namespace>.servicebus.windows.net/<queue>
output queueUrl string = 'https://${namespace.name}.servicebus.windows.net/${queue.name}'
output serviceHookSasRuleName string = enableServiceHookSasRule ? serviceHookSendRule.name : ''
