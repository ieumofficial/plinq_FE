// CORS headers shared by all Zoom-related Edge Functions. plinq's Electron
// renderer hits these from localhost:8888 (dev) and from the file:// origin
// (production build), so we allow any origin for now — same posture as
// plow_FE's Express backend (ALLOWED_ORIGIN=*).
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
