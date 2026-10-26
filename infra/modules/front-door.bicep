// OPTIONAL edge for access from outside the corporate network (enableFrontDoor=true).
// Azure Front Door Premium + WAF (Microsoft Default Rule Set 2.1, Bot Manager 1.1, per-IP rate limit)
// connected to the INTERNAL Container Apps environment through Private Link, so the origin still has no
// public endpoint. The private endpoint connection must be approved once after deployment
// (docs/DEPLOYMENT.md, "Optional: Azure Front Door").

param prefix string
param wafPolicyName string
param tags object
param logAnalyticsWorkspaceId string

@description('Region of the Container Apps environment (Private Link location).')
param originLocation string

param environmentId string

@description('Container App FQDN used as origin host and origin Host header.')
param originHostName string

@description('Requests per client IP per minute before WAF blocks.')
param rateLimitPerMinute int = 300

@description('Optional ISO 3166 country codes allowed through the WAF (e.g. ["DE","IN"]). Empty = no geo filter.')
param allowedCountryCodes array = []

var rateLimitRule = {
  name: 'RateLimitPerClientIp'
  enabledState: 'Enabled'
  priority: 100
  ruleType: 'RateLimitRule'
  rateLimitDurationInMinutes: 1
  rateLimitThreshold: rateLimitPerMinute
  groupBy: [
    {
      variableName: 'SocketAddr'
    }
  ]
  matchConditions: [
    {
      matchVariable: 'RequestUri'
      operator: 'Any'
      negateCondition: false
      matchValue: []
    }
  ]
  action: 'Block'
}

var geoRule = {
  name: 'BlockOutsideAllowedCountries'
  enabledState: 'Enabled'
  priority: 200
  ruleType: 'MatchRule'
  matchConditions: [
    {
      matchVariable: 'SocketAddr'
      operator: 'GeoMatch'
      negateCondition: true
      matchValue: allowedCountryCodes
    }
  ]
  action: 'Block'
}

resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2024-02-01' = {
  name: wafPolicyName
  location: 'global'
  tags: tags
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: 'Prevention'
      requestBodyCheck: 'Enabled'
      customBlockResponseStatusCode: 403
    }
    customRules: {
      rules: empty(allowedCountryCodes) ? [rateLimitRule] : [rateLimitRule, geoRule]
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Block'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.1'
        }
      ]
    }
  }
}

resource profile 'Microsoft.Cdn/profiles@2024-02-01' = {
  name: '${prefix}-afd'
  location: 'global'
  tags: tags
  sku: {
    name: 'Premium_AzureFrontDoor'
  }
  properties: {
    originResponseTimeoutSeconds: 60
  }
}

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2024-02-01' = {
  parent: profile
  name: '${prefix}-ep'
  location: 'global'
  tags: tags
  properties: {
    enabledState: 'Enabled'
  }
}

resource originGroup 'Microsoft.Cdn/profiles/originGroups@2024-02-01' = {
  parent: profile
  name: 'container-app'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/api/health/live'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 60
    }
    sessionAffinityState: 'Disabled'
  }
}

resource origin 'Microsoft.Cdn/profiles/originGroups/origins@2024-02-01' = {
  parent: originGroup
  name: 'internal-environment'
  properties: {
    hostName: originHostName
    originHostHeader: originHostName
    httpPort: 80
    httpsPort: 443
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
    sharedPrivateLinkResource: {
      privateLink: {
        id: environmentId
      }
      groupId: 'managedEnvironments'
      privateLinkLocation: originLocation
      requestMessage: 'Azure Front Door ${prefix}-afd'
    }
  }
}

resource route 'Microsoft.Cdn/profiles/afdEndpoints/routes@2024-02-01' = {
  parent: endpoint
  name: 'default'
  properties: {
    originGroup: {
      id: originGroup.id
    }
    supportedProtocols: ['Http', 'Https']
    httpsRedirect: 'Enabled'
    forwardingProtocol: 'HttpsOnly'
    patternsToMatch: ['/*']
    linkToDefaultDomain: 'Enabled'
    enabledState: 'Enabled'
  }
  dependsOn: [origin]
}

resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2024-02-01' = {
  parent: profile
  name: 'waf'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {
        id: wafPolicy.id
      }
      associations: [
        {
          domains: [
            {
              id: endpoint.id
            }
          ]
          patternsToMatch: ['/*']
        }
      ]
    }
  }
}

resource diagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-log-analytics'
  scope: profile
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

output endpointHostName string = endpoint.properties.hostName
output frontDoorId string = profile.properties.frontDoorId
