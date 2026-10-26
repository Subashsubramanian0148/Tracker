param name string
param location string
param tags object
param logAnalyticsWorkspaceId string
param infrastructureSubnetId string

@description('VNet IDs to link the environment default-domain private DNS zone to.')
param dnsLinkVnetIds array

@description('User-assigned identity attached to the environment (used to load custom-domain certificates from Key Vault).')
param identityId string

param zoneRedundant bool = false

@description('Disable the environment public network access flag. Required when Azure Front Door connects through Private Link.')
param disablePublicNetworkAccess bool = false

var baseProperties = {
  vnetConfiguration: {
    infrastructureSubnetId: infrastructureSubnetId
    // Internal load balancer only: no public IP is ever attached to the environment.
    internal: true
  }
  workloadProfiles: [
    {
      name: 'Consumption'
      workloadProfileType: 'Consumption'
    }
  ]
  // Logs flow through diagnostic settings (Entra-authenticated), no workspace shared key in the template.
  appLogsConfiguration: {
    destination: 'azure-monitor'
  }
  zoneRedundant: zoneRedundant
  // Encrypt traffic between replicas inside the environment.
  peerTrafficConfiguration: {
    encryption: {
      enabled: true
    }
  }
}

resource environment 'Microsoft.App/managedEnvironments@2025-07-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: disablePublicNetworkAccess ? union(baseProperties, { publicNetworkAccess: 'Disabled' }) : baseProperties
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: environment
  properties: {
    workspaceId: logAnalyticsWorkspaceId
    // Resource-specific tables: ContainerAppConsoleLogs, ContainerAppSystemLogs.
    logAnalyticsDestinationType: 'Dedicated'
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

// Resolves <app>.<defaultDomain> to the environment's internal load balancer for everything linked
// to these VNets (CI runner, Front Door private link, hub DNS forwarders for VPN users).
module defaultDomainZone 'private-dns-zone.bicep' = {
  name: '${name}-dns'
  params: {
    zoneName: environment.properties.defaultDomain
    tags: tags
    vnetIds: dnsLinkVnetIds
    aRecords: [
      {
        name: '*'
        ipv4Address: environment.properties.staticIp
      }
      {
        name: '@'
        ipv4Address: environment.properties.staticIp
      }
    ]
  }
}

output id string = environment.id
output name string = environment.name
output defaultDomain string = environment.properties.defaultDomain
output staticIp string = environment.properties.staticIp
