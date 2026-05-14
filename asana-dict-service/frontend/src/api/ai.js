import apiClient from './client';

/**
 * API для работы с ИИ-модерацией связей isSameAs.
 * Сервис asana-network-service сканирует фото и предлагает связи между
 * асанами; эксперт/админ через UI подтверждает или отклоняет каждую связь.
 */
export const aiAPI = {
  /** Запустить сканирование каталога нейросетью (может занять несколько минут). */
  startScan: async (options = {}) => {
    const payload = {
      use_yoga_class: options.useYogaClass ?? true,
      yoga_class_threshold: options.yogaClassThreshold ?? 0.55,
      skip_existing_links: options.skipExistingLinks ?? true,
    };
    const response = await apiClient.post('/api/ai/scan', payload);
    return response.data;
  },

  /**
   * Получить предложения для модерации.
   * @param {Object} opts
   * @param {boolean} [opts.resolved=false] — false: только pending; true: confirmed+rejected.
   * @param {'created_at'|'score'} [opts.sort='created_at']
   * @param {'asc'|'desc'} [opts.sortDir='desc']
   * @param {number} [opts.limit=500]
   */
  getProposals: async ({
    resolved = false,
    sort = 'created_at',
    sortDir = 'desc',
    limit = 500,
  } = {}) => {
    const response = await apiClient.get('/api/ai/proposals', {
      params: { resolved, sort, sort_dir: sortDir, limit },
    });
    return response.data;
  },

  /** Количество ожидающих модерации (для бейджа в navbar). */
  getPendingCount: async () => {
    const response = await apiClient.get('/api/ai/proposals/count');
    return response.data;
  },

  /** Подтвердить предложение → создать связь isSameAsObject. */
  confirm: async (proposalId) => {
    const response = await apiClient.patch(`/api/ai/proposals/${proposalId}/confirm`);
    return response.data;
  },

  /** Отклонить предложение → связь не создаётся. */
  reject: async (proposalId) => {
    const response = await apiClient.patch(`/api/ai/proposals/${proposalId}/reject`);
    return response.data;
  },

  /** Очистить очередь. По умолчанию удаляет всё, как обычная модерация. */
  clear: async (onlyResolved = false) => {
    const response = await apiClient.delete('/api/ai/proposals/all', {
      params: { only_resolved: onlyResolved },
    });
    return response.data;
  },
};
