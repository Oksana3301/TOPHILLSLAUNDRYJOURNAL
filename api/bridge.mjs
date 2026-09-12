import {handleVercelApi} from '../server/vercel-api.mjs';
export default {fetch: request => handleVercelApi(request, process.env)};
