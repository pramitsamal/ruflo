import { useQuery } from '@tanstack/react-query';
import { fetchEvents, fetchEvent, type SMMNEvent } from '../api/smmn-client';

export function useEvents(statusFilter?: string) {
  return useQuery<SMMNEvent[], Error>({
    queryKey: ['events', statusFilter ?? 'all'],
    queryFn: () => fetchEvents(statusFilter),
    staleTime: 30_000,
  });
}

export function useEvent(id: string) {
  return useQuery<SMMNEvent, Error>({
    queryKey: ['event', id],
    queryFn: () => fetchEvent(id),
    enabled: id.length > 0,
    staleTime: 30_000,
  });
}
