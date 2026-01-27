/**
 * 测试 GitHub 登录绑定作者功能的数据准备脚本
 *
 * 使用: npx tsx scripts/test-auth-setup.ts [setup|cleanup]
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://eccwfcfoysauxnnsvcwn.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  console.log('Run: source .env.local && npx tsx scripts/test-auth-setup.ts [command]');
  process.exit(1);
}

// 测试用的 GitHub 用户信息
const TEST_GITHUB_LOGIN = 'yan-labs';
const TEST_GITHUB_ID = 123456789; // 假的 GitHub ID，登录时会被真实的覆盖

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setup() {
  console.log('🚀 Setting up test data for yan-labs...\n');

  // 1. 创建或更新 author 记录（不设置 user_id，等登录时自动关联）
  console.log('1. Creating author record...');
  const { data: author, error: authorError } = await supabase
    .from('authors')
    .upsert({
      github_id: TEST_GITHUB_ID,
      github_login: TEST_GITHUB_LOGIN,
      name: 'Yan Labs',
      avatar_url: `https://github.com/${TEST_GITHUB_LOGIN}.png`,
      bio: 'Building awesome AI tools',
      user_id: null, // 登录时会自动填充
    }, { onConflict: 'github_id' })
    .select()
    .single();

  if (authorError) {
    console.error('❌ Failed to create author:', authorError);
    return;
  }
  console.log('✅ Author created:', author.id);

  // 2. 创建一些假的 external_skills
  console.log('\n2. Creating test skills...');

  const testSkills = [
    {
      source: 'github',
      source_id: `test-skill-1-${TEST_GITHUB_LOGIN}`,
      name: 'awesome-react-patterns',
      slug: 'awesome-react-patterns',
      description: 'A collection of React patterns and best practices for AI agents',
      repo: `${TEST_GITHUB_LOGIN}/awesome-react-patterns`,
      repo_path: 'skills/react-patterns',
      branch: 'main',
      raw_url: `https://raw.githubusercontent.com/${TEST_GITHUB_LOGIN}/awesome-react-patterns/main/SKILL.md`,
      author_id: author.id,
      github_owner: TEST_GITHUB_LOGIN,
      installs: 1234,
      stars: 567,
    },
    {
      source: 'github',
      source_id: `test-skill-2-${TEST_GITHUB_LOGIN}`,
      name: 'typescript-wizard',
      slug: 'typescript-wizard',
      description: 'Advanced TypeScript utilities and type helpers',
      repo: `${TEST_GITHUB_LOGIN}/typescript-wizard`,
      repo_path: null,
      branch: 'main',
      raw_url: `https://raw.githubusercontent.com/${TEST_GITHUB_LOGIN}/typescript-wizard/main/SKILL.md`,
      author_id: author.id,
      github_owner: TEST_GITHUB_LOGIN,
      installs: 890,
      stars: 234,
    },
    {
      source: 'github',
      source_id: `test-skill-3-${TEST_GITHUB_LOGIN}`,
      name: 'api-design-guide',
      slug: 'api-design-guide',
      description: 'RESTful API design principles and patterns',
      repo: `${TEST_GITHUB_LOGIN}/api-design-guide`,
      repo_path: null,
      branch: 'main',
      raw_url: `https://raw.githubusercontent.com/${TEST_GITHUB_LOGIN}/api-design-guide/main/SKILL.md`,
      author_id: author.id,
      github_owner: TEST_GITHUB_LOGIN,
      installs: 456,
      stars: 123,
    },
  ];

  for (const skill of testSkills) {
    const { error } = await supabase
      .from('external_skills')
      .upsert(skill, { onConflict: 'source,source_id' });

    if (error) {
      console.error(`❌ Failed to create skill ${skill.name}:`, error);
    } else {
      console.log(`✅ Created skill: ${skill.name}`);
    }
  }

  // 3. 更新作者统计
  console.log('\n3. Updating author stats...');
  const { error: statsError } = await supabase.rpc('update_author_stats', { p_author_id: author.id });
  if (statsError) {
    console.log('⚠️  Stats update skipped (function may not exist):', statsError.message);
  } else {
    console.log('✅ Author stats updated');
  }

  console.log('\n✨ Setup complete!');
  console.log(`\nNow login with GitHub account: ${TEST_GITHUB_LOGIN}`);
  console.log('After login, check:');
  console.log(`  1. Header dropdown shows "My Profile" link`);
  console.log(`  2. Click it to go to /authors/${TEST_GITHUB_LOGIN}`);
  console.log(`  3. You should see 3 test skills listed`);
}

async function cleanup() {
  console.log('🧹 Cleaning up test data for yan-labs...\n');

  // 1. 删除测试 skills
  console.log('1. Deleting test skills...');
  const { error: skillsError } = await supabase
    .from('external_skills')
    .delete()
    .eq('github_owner', TEST_GITHUB_LOGIN)
    .like('source_id', `test-skill-%`);

  if (skillsError) {
    console.error('❌ Failed to delete skills:', skillsError);
  } else {
    console.log('✅ Test skills deleted');
  }

  // 2. 重置 author 的 user_id（保留 author 记录，只清除登录关联）
  console.log('\n2. Resetting author user_id...');
  const { error: authorError } = await supabase
    .from('authors')
    .update({ user_id: null })
    .eq('github_login', TEST_GITHUB_LOGIN);

  if (authorError) {
    console.error('❌ Failed to reset author:', authorError);
  } else {
    console.log('✅ Author user_id reset to null');
  }

  console.log('\n✨ Cleanup complete! You can run setup again to test.');
}

async function status() {
  console.log('📊 Checking current status for yan-labs...\n');

  // 检查 author
  const { data: author } = await supabase
    .from('authors')
    .select('*')
    .eq('github_login', TEST_GITHUB_LOGIN)
    .single();

  if (author) {
    console.log('Author record:');
    console.log(`  ID: ${author.id}`);
    console.log(`  GitHub ID: ${author.github_id}`);
    console.log(`  GitHub Login: ${author.github_login}`);
    console.log(`  User ID (linked): ${author.user_id || '(not linked)'}`);
    console.log(`  Skill Count: ${author.external_skill_count || 0}`);
    console.log(`  Total Installs: ${author.total_installs || 0}`);
  } else {
    console.log('❌ No author record found');
  }

  // 检查 skills
  const { data: skills } = await supabase
    .from('external_skills')
    .select('name, installs, stars')
    .eq('github_owner', TEST_GITHUB_LOGIN);

  if (skills && skills.length > 0) {
    console.log(`\nSkills (${skills.length}):`);
    for (const skill of skills) {
      console.log(`  - ${skill.name} (${skill.installs} installs, ${skill.stars} stars)`);
    }
  } else {
    console.log('\n❌ No skills found');
  }
}

// Main
const command = process.argv[2] || 'status';

switch (command) {
  case 'setup':
    setup();
    break;
  case 'cleanup':
    cleanup();
    break;
  case 'status':
    status();
    break;
  default:
    console.log('Usage: npx tsx scripts/test-auth-setup.ts [setup|cleanup|status]');
}
