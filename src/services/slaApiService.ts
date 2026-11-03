import type { SlaConfig } from '../types';
import { apiFetch, notifyDataChanged, readApiResponse } from './http';

export async function listSlaConfigs(): Promise<SlaConfig[]> {
  const response = await apiFetch('/api/sla_configs');
  const body = await readApiResponse(response);
  return (body.configs as Array<Record<string, any>>).map((row) => ({
    priority: row.priority,
    responseMinutes: Number(row.response_minutes),
    resolveHours: Number(row.resolve_hours),
    description: row.description || '',
  }));
}

export async function saveSlaConfigs(configs: SlaConfig[]): Promise<void> {
  const response = await apiFetch('/api/sla_configs', {
    method: 'PUT',
    body: JSON.stringify({ configs }),
  });
  await readApiResponse(response);
  notifyDataChanged();
}
