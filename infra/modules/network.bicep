@description('Resource name prefix, e.g. adom-prod.')
param prefix string

param location string
param tags object
param logAnalyticsWorkspaceId string

@description('VNet address space.')
param addressPrefix string

@description('Container Apps environment infrastructure subnet (delegated to Microsoft.App/environments).')
param containerAppsSubnetPrefix string

@description('Private endpoint subnet.')
param privateEndpointSubnetPrefix string

@description('PostgreSQL Flexible Server subnet (delegated to Microsoft.DBforPostgreSQL/flexibleServers).')
param postgresSubnetPrefix string

@description('Optional tools subnet for a self-hosted CI runner / jump host. Empty string = not created.')
param toolsSubnetPrefix string = ''

@description('Additional source CIDRs allowed to reach PostgreSQL on 5432 (e.g. a DBA VPN range). The app and tools subnets are always allowed.')
param postgresAdditionalSourcePrefixes array = []

@description('Custom DNS servers for the VNet (e.g. hub DNS resolver). Empty = Azure-provided DNS.')
param dnsServers array = []

var createToolsSubnet = !empty(toolsSubnetPrefix)
var postgresClientPrefixes = concat(
  [containerAppsSubnetPrefix],
  createToolsSubnet ? [toolsSubnetPrefix] : [],
  postgresAdditionalSourcePrefixes
)

var denyInternetInbound = {
  name: 'DenyInternetInbound'
  properties: {
    priority: 4000
    direction: 'Inbound'
    access: 'Deny'
    protocol: '*'
    sourceAddressPrefix: 'Internet'
    sourcePortRange: '*'
    destinationAddressPrefix: '*'
    destinationPortRange: '*'
  }
}

resource nsgContainerApps 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: '${prefix}-nsg-aca'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowVnetHttpsInbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: containerAppsSubnetPrefix
          // 80 is accepted only to answer with an HTTPS redirect (ingress allowInsecure=false).
          destinationPortRanges: ['443', '80']
        }
      }
      {
        name: 'AllowAzureLoadBalancerInbound'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: 'AzureLoadBalancer'
          sourcePortRange: '*'
          destinationAddressPrefix: containerAppsSubnetPrefix
          destinationPortRange: '*'
        }
      }
      denyInternetInbound
    ]
  }
}

resource nsgPrivateEndpoints 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: '${prefix}-nsg-pe'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowVnetHttpsInbound'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: privateEndpointSubnetPrefix
          // 443: Key Vault, ACR, Storage. 5671/5672: Service Bus AMQP (Premium private endpoint only).
          destinationPortRanges: ['443', '5671', '5672']
        }
      }
      {
        name: 'DenyAllOtherInbound'
        properties: {
          priority: 4000
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource nsgPostgres 'Microsoft.Network/networkSecurityGroups@2024-05-01' = {
  name: '${prefix}-nsg-psql'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'AllowPostgresFromApprovedSubnets'
        properties: {
          priority: 100
          direction: 'Inbound'
          access: 'Allow'
          protocol: 'Tcp'
          sourceAddressPrefixes: postgresClientPrefixes
          sourcePortRange: '*'
          destinationAddressPrefix: postgresSubnetPrefix
          destinationPortRange: '5432'
        }
      }
      {
        // Replication and management traffic between the primary and HA standby.
        name: 'AllowIntraSubnet'
        properties: {
          priority: 110
          direction: 'Inbound'
          access: 'Allow'
          protocol: '*'
          sourceAddressPrefix: postgresSubnetPrefix
          sourcePortRange: '*'
          destinationAddressPrefix: postgresSubnetPrefix
          destinationPortRange: '*'
        }
      }
      {
        name: 'DenyOtherVnetInbound'
        properties: {
          priority: 3900
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: 'VirtualNetwork'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
      denyInternetInbound
    ]
  }
}

resource nsgTools 'Microsoft.Network/networkSecurityGroups@2024-05-01' = if (createToolsSubnet) {
  name: '${prefix}-nsg-tools'
  location: location
  tags: tags
  properties: {
    securityRules: [
      denyInternetInbound
    ]
  }
}

var baseSubnets = [
  {
    name: 'snet-aca'
    properties: {
      addressPrefix: containerAppsSubnetPrefix
      networkSecurityGroup: {
        id: nsgContainerApps.id
      }
      delegations: [
        {
          name: 'Microsoft.App.environments'
          properties: {
            serviceName: 'Microsoft.App/environments'
          }
        }
      ]
    }
  }
  {
    name: 'snet-pe'
    properties: {
      addressPrefix: privateEndpointSubnetPrefix
      networkSecurityGroup: {
        id: nsgPrivateEndpoints.id
      }
      // Required for NSG rules to apply to private endpoint NICs.
      privateEndpointNetworkPolicies: 'Enabled'
      defaultOutboundAccess: false
    }
  }
  {
    name: 'snet-psql'
    properties: {
      addressPrefix: postgresSubnetPrefix
      networkSecurityGroup: {
        id: nsgPostgres.id
      }
      delegations: [
        {
          name: 'Microsoft.DBforPostgreSQL.flexibleServers'
          properties: {
            serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
          }
        }
      ]
    }
  }
]

var toolsSubnet = createToolsSubnet
  ? [
      {
        name: 'snet-tools'
        properties: {
          addressPrefix: toolsSubnetPrefix
          networkSecurityGroup: {
            id: nsgTools.id
          }
        }
      }
    ]
  : []

resource vnet 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${prefix}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [addressPrefix]
    }
    dhcpOptions: empty(dnsServers)
      ? null
      : {
          dnsServers: dnsServers
        }
    subnets: concat(baseSubnets, toolsSubnet)
  }
}

var nsgs = concat(
  [nsgContainerApps.name, nsgPrivateEndpoints.name, nsgPostgres.name],
  createToolsSubnet ? ['${prefix}-nsg-tools'] : []
)

resource nsgRefs 'Microsoft.Network/networkSecurityGroups@2024-05-01' existing = [
  for nsgName in nsgs: {
    name: nsgName
  }
]

resource nsgDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = [
  for (nsgName, i) in nsgs: {
    name: 'to-log-analytics'
    scope: nsgRefs[i]
    dependsOn: [vnet]
    properties: {
      workspaceId: logAnalyticsWorkspaceId
      logs: [
        {
          categoryGroup: 'allLogs'
          enabled: true
        }
      ]
    }
  }
]

resource vnetDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: vnet
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

output vnetId string = vnet.id
output vnetName string = vnet.name
output containerAppsSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'snet-aca')
output privateEndpointSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'snet-pe')
output postgresSubnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'snet-psql')
output toolsSubnetId string = createToolsSubnet ? resourceId('Microsoft.Network/virtualNetworks/subnets', vnet.name, 'snet-tools') : ''
