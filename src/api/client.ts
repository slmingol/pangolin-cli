import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import {
  Resource,
  Target,
  HealthCheck,
  Site,
  ResourceUpdatePayload,
  TargetUpdatePayload,
  PaginatedResponse,
} from '../types';

dotenv.config();

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}. Copy .env.example to .env and fill it in.`);
  return val;
}

export class PangolinClient {
  private http: AxiosInstance;
  readonly orgId: string;

  constructor() {
    const baseURL = getEnv('PANGOLIN_URL').replace(/\/$/, '');
    this.orgId = getEnv('PANGOLIN_ORG_ID');

    this.http = axios.create({
      baseURL: `${baseURL}/v1`,
      headers: {
        Authorization: `Bearer ${getEnv('PANGOLIN_API_KEY')}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Resources

  async listResourcesPage(page: number, pageSize = 100): Promise<{ resources: Resource[]; total: number }> {
    const res = await this.http.get<{ data: { resources: Resource[]; pagination: { total: number; pageSize: number; page: number } } }>(
      `/org/${this.orgId}/resources`,
      { params: { page, pageSize } }
    );
    return {
      resources: res.data.data.resources ?? [],
      total: res.data.data.pagination?.total ?? 0,
    };
  }

  async getAllResources(): Promise<Resource[]> {
    const all: Resource[] = [];
    let page = 1;
    while (true) {
      const { resources, total } = await this.listResourcesPage(page);
      all.push(...resources);
      if (all.length >= total || resources.length === 0) break;
      page++;
    }
    return all;
  }

  async updateResource(resourceId: number, payload: ResourceUpdatePayload): Promise<Resource> {
    const res = await this.http.post<{ data: Resource }>(`/resource/${resourceId}`, payload);
    return res.data.data;
  }

  async deleteResource(resourceId: number): Promise<void> {
    await this.http.delete(`/resource/${resourceId}`);
  }

  // Targets

  async listTargets(resourceId: number): Promise<Target[]> {
    const res = await this.http.get<{ data: { targets: Target[] } }>(
      `/resource/${resourceId}/targets`
    );
    return res.data.data.targets ?? [];
  }

  async updateTarget(targetId: number, payload: TargetUpdatePayload): Promise<Target> {
    const res = await this.http.post<{ data: Target }>(`/target/${targetId}`, payload);
    return res.data.data;
  }

  async deleteTarget(targetId: number): Promise<void> {
    await this.http.delete(`/target/${targetId}`);
  }

  // Health checks

  async listHealthChecks(): Promise<HealthCheck[]> {
    const res = await this.http.get<{ data: { healthChecks: HealthCheck[] } }>(
      `/org/${this.orgId}/health-checks`
    );
    return res.data.data.healthChecks ?? [];
  }

  // Sites

  async listSites(): Promise<Site[]> {
    const res = await this.http.get<{ data: { sites: Site[] } }>(
      `/org/${this.orgId}/sites`,
      { params: { limit: 1000 } }
    );
    return res.data.data.sites ?? [];
  }
}

export const client = new PangolinClient();
