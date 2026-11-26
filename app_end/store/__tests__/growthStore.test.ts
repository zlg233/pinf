import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGrowthStore } from '../growthStore';
import type { GrowthRecord } from '@/types/growth';

// Mock the growth API
vi.mock('@/services/api/growth', () => ({
  listGrowth: vi.fn(),
  createGrowth: vi.fn(),
  updateGrowth: vi.fn(),
  deleteGrowth: vi.fn(),
}));

import * as growthApi from '@/services/api/growth';

const weightRecord: GrowthRecord = {
  id: 1,
  metric: 'weight',
  value: 5.5,
  unit: 'kg',
  recordedAt: '2024-01-15',
};

describe('growthStore', () => {
  beforeEach(() => {
    // Reset store state
    useGrowthStore.getState().clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have empty records', () => {
      const state = useGrowthStore.getState();
      expect(state.records).toEqual({});
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetch', () => {
    it('should set loading true while fetching', async () => {
      vi.mocked(growthApi.listGrowth).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      const fetchPromise = useGrowthStore.getState().fetch(1);

      // Should be loading immediately
      expect(useGrowthStore.getState().loading).toBe(true);

      await fetchPromise;

      expect(useGrowthStore.getState().loading).toBe(false);
    });

    it('should load records and sort by date', async () => {
      const mockRecords = [
        { ...weightRecord, recordedAt: '2024-03-15' },
        { ...weightRecord, id: 2, value: 6 },
        { ...weightRecord, id: 3, value: 5.8, recordedAt: '2024-02-15' },
      ];

      vi.mocked(growthApi.listGrowth).mockResolvedValue(mockRecords);

      await useGrowthStore.getState().fetch(1);

      const records = useGrowthStore.getState().records[1];
      expect(records).toHaveLength(3);
      // Should be sorted by recordedAt ascending
      expect(new Date(records[0].recordedAt) <= new Date(records[1].recordedAt)).toBe(true);
      expect(new Date(records[1].recordedAt) <= new Date(records[2].recordedAt)).toBe(true);
    });

    it('should set error on fetch failure', async () => {
      vi.mocked(growthApi.listGrowth).mockRejectedValue(new Error('Network error'));

      await expect(useGrowthStore.getState().fetch(1)).rejects.toThrow();

      const state = useGrowthStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.loading).toBe(false);
    });
  });

  describe('add', () => {
    it('should call createGrowth API and refetch', async () => {
      vi.mocked(growthApi.createGrowth).mockResolvedValue(weightRecord);
      vi.mocked(growthApi.listGrowth).mockResolvedValue([]);

      await useGrowthStore.getState().add(1, [{ metric: 'weight', value: 5.5, unit: 'kg', recordedAt: '2024-01-01' }]);

      expect(growthApi.createGrowth).toHaveBeenCalledTimes(1);
      expect(growthApi.listGrowth).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('should update record in place without refetch', async () => {
      const updatedRecord = { ...weightRecord, value: 6 };

      // Pre-populate store
      useGrowthStore.setState({
        records: { 1: [weightRecord] },
      });

      vi.mocked(growthApi.updateGrowth).mockResolvedValue(updatedRecord);

      await useGrowthStore.getState().update(1, { value: 6 });

      expect(growthApi.updateGrowth).toHaveBeenCalledTimes(1);
      const records = useGrowthStore.getState().records[1];
      expect(records[0].value).toBe(6);
    });
  });

  describe('remove', () => {
    it('should remove record from store', async () => {
      // Pre-populate store
      useGrowthStore.setState({
        records: { 1: [weightRecord] },
      });

      vi.mocked(growthApi.deleteGrowth).mockResolvedValue(undefined);

      await useGrowthStore.getState().remove(1, 1);

      expect(growthApi.deleteGrowth).toHaveBeenCalledTimes(1);
      expect(useGrowthStore.getState().records[1]).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should reset state to initial', async () => {
      useGrowthStore.setState({
        records: { 1: [weightRecord] },
        loading: true,
        error: 'Some error',
      });

      useGrowthStore.getState().clear();

      const state = useGrowthStore.getState();
      expect(state.records).toEqual({});
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
