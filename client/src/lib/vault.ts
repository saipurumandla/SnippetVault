import { createClient } from '@snippetvault/api-client';

export const vault = createClient({ baseUrl: '/api', token: () => localStorage.getItem('token') });
