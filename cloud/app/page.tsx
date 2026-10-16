import { requireChatGPTUser } from './chatgpt-auth';
import LifeApp from './life-app';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/');return <LifeApp/>}
