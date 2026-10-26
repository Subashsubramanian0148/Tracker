// Change queue on Azure Storage Queues (alternative, CHANGE_QUEUE_KIND=storage).
//
// Trade-off: the ADO "Azure Storage" service hook authenticates with either an Azure Resource Manager
// service connection (Entra ID) or the storage ACCOUNT KEY. An account key grants full control of
// every service in the account and cannot be scoped to one queue, so allowSharedKeyAccess stays false
// unless you explicitly accept that risk (allowSharedKeyAccess=true). Service Bus is the default
// because its fallback (queue-scoped, Send-only SAS) is least-privilege.

param name string
param location string
param tags object
param logAnalyticsWorkspaceId string
param privateEndpointSubnetId string
param privateDnsZoneId string

param queueName string

@description('Only set true if the ADO service hook must use an account key (no ARM service connection available).')
param allowSharedKeyAccess bool = false

@description('Principal ID of the identity behind the ADO "Azure Resource Manager" service connection. Empty = not granted.')
param serviceHookSenderPrincipalId string = ''

@description('Principal ID of the app identity (reads and deletes messages).')
param receiverPrincipalId string

resource account 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  tags: tags
  kind: 'StorageV2'
  sku: {
    name: 'Standard_ZRS'
  }
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: allowSharedKeyAccess
    defaultToOAuthAuthentication: true
    allowCrossTenantReplication: false
    // Public endpoint is required: Azure DevOps service hooks deliver from the Azure DevOps cloud.
    // The app itself reads through the private endpoint below.
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
    encryption: {
      requireInfrastructureEncryption: true
      keySource: 'Microsoft.Storage'
      services: {
        queue: {
          enabled: true
          keyType: 'Account'
        }
        blob: {
          enabled: true
          keyType: 'Account'
        }
      }
    }
  }
}

resource queueService 'Microsoft.Storage/storageAccounts/queueServices@2023-05-01' = {
  parent: account
  name: 'default'
}

resource queue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-05-01' = {
  parent: queueService
  name: queueName
}

var messageProcessorRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '8a0f0c08-91a1-4084-bc3d-661d67233fed')
var messageSenderRoleId = subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'c6a89b2d-59bc-44d0-9896-0f6e12d7b80a')

resource receiverAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(queue.id, receiverPrincipalId, messageProcessorRoleId)
  scope: queue
  properties: {
    roleDefinitionId: messageProcessorRoleId
    principalId: receiverPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource senderAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(serviceHookSenderPrincipalId)) {
  name: guid(queue.id, serviceHookSenderPrincipalId, messageSenderRoleId)
  scope: queue
  properties: {
    roleDefinitionId: messageSenderRoleId
    principalId: serviceHookSenderPrincipalId
    principalType: 'ServicePrincipal'
  }
}

module privateEndpoint 'private-endpoint.bicep' = {
  name: '${name}-pe-queue'
  params: {
    name: '${name}-pe-queue'
    location: location
    tags: tags
    subnetId: privateEndpointSubnetId
    privateLinkServiceId: account.id
    groupId: 'queue'
    privateDnsZoneId: privateDnsZoneId
  }
}

resource accountDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: account
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    metrics: [
      {
        category: 'Transaction'
        enabled: true
      }
    ]
  }
}

resource queueDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: queueService
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
        category: 'Transaction'
        enabled: true
      }
    ]
  }
}

output accountId string = account.id
output accountName string = account.name
output queueUrl string = '${account.properties.primaryEndpoints.queue}${queue.name}'
