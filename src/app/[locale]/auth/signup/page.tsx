import { redirect } from 'next/navigation';

// 注册和登录合并为一个流程（OAuth 自动处理）
export default function SignUpPage() {
  redirect('/auth/signin');
}
