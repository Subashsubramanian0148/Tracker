param name string
param location string
param tags object
param subnetId string

@description('Resource ID of the target (Key Vault, ACR, Storage account, Service Bus namespace).')
param privateLinkServiceId string

@description('Target sub-resource, e.g. vault, registry, queue, namespace.')
param groupId string

param privateDnsZoneId string

resource privateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    subnet: {
      id: subnetId
    }
    customNetworkInterfaceName: '${name}-nic'
    privateLinkServiceConnections: [
      {
        name: name
        properties: {
          privateLinkServiceId: privateLinkServiceId
          groupIds: [groupId]
        }
      }
    ]
  }
}

resource dnsZoneGroup 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: privateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: replace(last(split(privateDnsZoneId, '/')), '.', '-')
        properties: {
          privateDnsZoneId: privateDnsZoneId
        }
      }
    ]
  }
}

output id string = privateEndpoint.id
