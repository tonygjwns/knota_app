import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import PendingApprovalScreen from '@/components/PendingApprovalScreen';

// Page imports
import Landing from './pages/Landing';
import Home from './pages/Home';
import ProblemSelect from './pages/ProblemSelect';
import ProblemSolve from './pages/ProblemSolve';
import ResultView from './pages/ResultView';
import History from './pages/History';

// Admin
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminTeachers from './pages/admin/AdminTeachers';
import AdminStudents from './pages/admin/AdminStudents';
import AdminProblems from './pages/admin/AdminProblems';
import AdminAcademies from './pages/admin/AdminAcademies';
import AdminInviteCodes from './pages/admin/AdminInviteCodes';
import TeacherLayout from './pages/teacher/TeacherLayout';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import TeacherStudents from './pages/teacher/TeacherStudents';
import TeacherClasses from './pages/teacher/TeacherClasses';
import TeacherAssignments from './pages/teacher/TeacherAssignments';
import AssignmentDetail from './pages/teacher/AssignmentDetail';
import TeacherReview from './pages/teacher/TeacherReview';
import TeacherReviewDetail from './pages/teacher/TeacherReviewDetail';
import TeacherProblems from './pages/teacher/TeacherProblems';
import StudentAssignment from './pages/StudentAssignment';
import Profile from './pages/Profile';
import StudentDetail from './pages/shared/StudentDetail';
import ProblemDetail from './pages/shared/ProblemDetail';
import RemediationRetry from './pages/remediation/RemediationRetry';
import RemediationLesson from './pages/remediation/RemediationLesson';
import RemediationPractice from './pages/remediation/RemediationPractice';
import RemediationComplete from './pages/remediation/RemediationComplete';
import Bookmarks from './pages/Bookmarks';
import Withdraw from './pages/Withdraw';
import Diagnosis from './pages/Diagnosis.jsx';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
            <span className="text-white font-bold text-xl">수</span>
          </div>
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">수학 학습을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // 비로그인 상태면 항상 Landing 렌더 (경로 무관)
      return <Landing />;
    }
  }

  // Block non-approved users (admins and owners bypass the check)
  if (user && user.role !== 'admin' && user.role !== 'owner') {
    if (user.approval_status !== 'approved') {
      return <PendingApprovalScreen user={user} />;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/home" element={<Home />} />
      <Route path="/problems" element={<ProblemSelect />} />
      <Route path="/problem/:id" element={<ProblemSolve />} />
      <Route path="/result/:id" element={<ResultView />} />
      <Route path="/history" element={<History />} />
      <Route path="/assignment/:assignmentId" element={<StudentAssignment />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/remediation/:attemptId/retry" element={<RemediationRetry />} />
      <Route path="/remediation/:attemptId/lesson" element={<RemediationLesson />} />
      <Route path="/remediation/:attemptId/practice/:practiceIdx" element={<RemediationPractice />} />
      <Route path="/remediation/:attemptId/complete" element={<RemediationComplete />} />
      <Route path="/bookmarks" element={<Bookmarks />} />
      <Route path="/withdraw" element={<Withdraw />} />
      <Route path="/diagnosis" element={<Diagnosis />} />

      {/* Admin routes */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="teachers" element={<AdminTeachers />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="students/:userId" element={<StudentDetail mode="admin" />} />
        <Route path="problems" element={<AdminProblems />} />
        <Route path="problems/:problemId" element={<ProblemDetail mode="admin" />} />
        <Route path="academies" element={<AdminAcademies />} />
        <Route path="invite-codes" element={<AdminInviteCodes />} />
      </Route>

      {/* Teacher routes */}
      <Route path="/teacher" element={<TeacherLayout />}>
        <Route index element={<TeacherDashboard />} />
        <Route path="students" element={<TeacherStudents />} />
        <Route path="students/:userId" element={<StudentDetail mode="teacher" />} />
        <Route path="classes" element={<TeacherClasses />} />
        <Route path="assignments" element={<TeacherAssignments />} />
        <Route path="assignments/:assignmentId" element={<AssignmentDetail />} />
        <Route path="problems" element={<TeacherProblems />} />
        <Route path="problems/:problemId" element={<ProblemDetail mode="teacher" />} />
        <Route path="review" element={<TeacherReview />} />
        <Route path="review/:attemptId" element={<TeacherReviewDetail />} />
        <Route path="bookmarks" element={<Bookmarks />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App