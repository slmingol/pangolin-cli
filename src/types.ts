export interface Resource {
  resourceId: number;
  niceId: string;
  name: string;
  subdomain?: string;
  fullDomain?: string;
  ssl?: boolean;
  sso?: boolean;
  blockAccess?: boolean;
  emailWhitelistEnabled?: boolean;
  applyRules?: boolean;
  enabled?: boolean;
  stickySession?: boolean;
  tlsServerName?: string;
  setHostHeader?: boolean;
  http?: boolean;
  domainId?: number;
  maintenanceModeEnabled?: boolean;
}

export interface Target {
  targetId: number;
  resourceId: number;
  siteId: number;
  ip: string;
  port: number;
  method?: string;
  enabled?: boolean;
  path?: string;
  priority?: number;
  hcEnabled?: boolean;
  hcPath?: string;
  hcScheme?: string;
  hcMode?: string;
  hcHostname?: string;
  hcPort?: number;
  hcInterval?: number;
  hcUnhealthyInterval?: number;
  hcTimeout?: number;
  hcHealthyThreshold?: number;
  hcUnhealthyThreshold?: number;
  hcMethod?: string;
  hcStatus?: number;
  hcFollowRedirects?: boolean;
}

export interface HealthCheck {
  healthCheckId: number;
  name: string;
  mode: 'http' | 'tcp' | 'snmp' | 'ping';
}

export interface Site {
  siteId: number;
  niceId: string;
  name: string;
  type: string;
}

export interface ResourceUpdatePayload {
  name?: string;
  niceId?: string;
  subdomain?: string;
  ssl?: boolean;
  sso?: boolean;
  blockAccess?: boolean;
  emailWhitelistEnabled?: boolean;
  applyRules?: boolean;
  enabled?: boolean;
  stickySession?: boolean;
  tlsServerName?: string;
  setHostHeader?: boolean;
  maintenanceModeEnabled?: boolean;
  maintenanceModeType?: string;
  maintenanceTitle?: string;
  maintenanceMessage?: string;
}

export interface TargetUpdatePayload {
  siteId?: number;
  ip?: string;
  method?: string;
  port?: number;
  enabled?: boolean;
  hcEnabled?: boolean;
  hcPath?: string;
  hcScheme?: string;
  hcMode?: string;
  hcHostname?: string;
  hcPort?: number;
  hcInterval?: number;
  hcUnhealthyInterval?: number;
  hcTimeout?: number;
  hcHealthyThreshold?: number;
  hcUnhealthyThreshold?: number;
  hcMethod?: string;
  hcStatus?: number;
  hcFollowRedirects?: boolean;
  priority?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}
