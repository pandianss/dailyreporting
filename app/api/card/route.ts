import { renderScorecardSvg } from '../../../lib/scorecard-svg';
import branches from '../../branches.json';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sol = url.searchParams.get('sol') || '';
  const date = url.searchParams.get('date') || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  if (!sol) {
    return new Response('sol query parameter required', { status: 400 });
  }

  const branch = branches.find((b: any) => b.sol === sol);
  const svg = renderScorecardSvg({ sol, date, branch });

  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=120',
    },
  });
}
