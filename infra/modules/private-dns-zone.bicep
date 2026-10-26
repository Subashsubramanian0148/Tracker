@description('Private DNS zone name, e.g. privatelink.vaultcore.azure.net.')
param zoneName string

param tags object

@description('VNet resource IDs to link the zone to (the workload VNet plus any hub / DNS-resolver VNets).')
param vnetIds array

@description('Optional A records: [{ name: string, ipv4Address: string }].')
param aRecords array = []

resource zone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: zoneName
  location: 'global'
  tags: tags
}

resource links 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = [
  for (vnetId, i) in vnetIds: {
    parent: zone
    name: 'link-${i}-${uniqueString(vnetId)}'
    location: 'global'
    tags: tags
    properties: {
      registrationEnabled: false
      virtualNetwork: {
        id: vnetId
      }
    }
  }
]

resource records 'Microsoft.Network/privateDnsZones/A@2024-06-01' = [
  for record in aRecords: {
    parent: zone
    name: record.name
    properties: {
      ttl: 300
      aRecords: [
        {
          ipv4Address: record.ipv4Address
        }
      ]
    }
  }
]

output id string = zone.id
output name string = zone.name
