import { NextRequest, NextResponse } from 'next/server';


const SKILLSMP_API_URL = 'https://skillsmp.com/api/v1';
const SKILLSMP_API_KEY = process.env.SKILLSMP_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!query) {
      return NextResponse.json([]);
    }

    if (!SKILLSMP_API_KEY) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    // 转发到 skillsmp AI search
    const skillsmpUrl = new URL(`${SKILLSMP_API_URL}/skills/ai-search`);
    skillsmpUrl.searchParams.set('q', query);

    const response = await fetch(skillsmpUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${SKILLSMP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('skillsmp AI search API error:', response.status);
      return NextResponse.json(
        { error: 'Failed to fetch from skillsmp' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.success || !data.data?.data) {
      return NextResponse.json([]);
    }

    // 格式化响应，适配 CLI 格式
    const skills = data.data.data.slice(0, limit).map((item: AiSearchResult) => ({
      id: item.skill.id,
      name: item.skill.name,
      slug: item.skill.id,
      description: item.skill.description,
      author: item.skill.author,
      githubUrl: item.skill.githubUrl,
      skillUrl: item.skill.skillUrl,
      stars: item.skill.stars || 0,
      updatedAt: item.skill.updatedAt,
      score: item.score, // AI 相关度分数
    }));

    return NextResponse.json(skills);
  } catch (error) {
    console.error('AI Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

interface AiSearchResult {
  file_id: string;
  filename: string;
  score: number;
  skill: {
    id: string;
    name: string;
    author: string;
    description: string;
    githubUrl: string;
    skillUrl: string;
    stars?: number;
    updatedAt?: number;
  };
}
