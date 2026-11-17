import { renderScorecardSvg } from '../../../lib/scorecard-svg';
import { renderAnnouncementSvg } from '../../../lib/announcement-svg';
import branches from '../../branches.json';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get('type') || '';
  const date = url.searchParams.get('date') || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  if (type === 'announcement' || (!url.searchParams.get('sol') && type !== 'scorecard')) {
    const deadline = url.searchParams.get('deadline') || '17:00';
    const cutoff = url.searchParams.get('cutoff') || 'yesterday';
    const baseline = url.searchParams.get('baseline') || 'Prior month-end confirmed position';
    const fundedDefinition = url.searchParams.get('funded') || 'As per official guidelines';
    const version = Number(url.searchParams.get('v') || 1);
    const svg = renderAnnouncementSvg({ date, deadline, cutoff, baseline, fundedDefinition, version });
    return new Response(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=120',
      },
    });
  }

  const sol = url.searchParams.get('sol') || '';
  if (!sol) {
    return new Response('sol query parameter or type=announcement required', { status: 400 });
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
