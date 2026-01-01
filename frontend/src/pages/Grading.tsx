import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { CheckSquare, FileText, Loader2, CheckCircle, XCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Grading() {
  const [selectedExamId, setSelectedExamId] = useState('');
  const [studentName, setStudentName] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [gradingResult, setGradingResult] = useState<any>(null);

  // Get exams
  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/exams`);
      return res.data;
    },
  });

  // Get exam details
  const { data: examDetails } = useQuery({
    queryKey: ['exam', selectedExamId],
    queryFn: async () => {
      if (!selectedExamId) return null;
      const res = await axios.get(`${API_URL}/exams/${selectedExamId}`);
      return res.data;
    },
    enabled: !!selectedExamId,
  });

  // Get grading results
  const { data: results } = useQuery({
    queryKey: ['grading-results', selectedExamId],
    queryFn: async () => {
      if (!selectedExamId) return [];
      const res = await axios.get(`${API_URL}/grading/results/${selectedExamId}`);
      return res.data;
    },
    enabled: !!selectedExamId,
  });

  const gradeMutation = useMutation({
    mutationFn: async (data: { examId: string; answers: Record<string, string>; studentName?: string }) => {
      const res = await axios.post(`${API_URL}/grading/mcq`, data);
      return res.data;
    },
    onSuccess: (data) => {
      setGradingResult(data);
      setAnswers({});
      setStudentName('');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Chấm bài thất bại');
    },
  });

  const handleGrade = () => {
    if (!selectedExamId || Object.keys(answers).length === 0) {
      alert('Vui lòng chọn đề thi và nhập đáp án');
      return;
    }
    gradeMutation.mutate({
      examId: selectedExamId,
      answers,
      studentName: studentName || undefined,
    });
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Chấm bài</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Nhập đáp án</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Đề thi</label>
              {isLoading ? (
                <p className="text-gray-500">Đang tải...</p>
              ) : (
                <select
                  value={selectedExamId}
                  onChange={(e) => {
                    setSelectedExamId(e.target.value);
                    setAnswers({});
                    setGradingResult(null);
                  }}
                  className="input"
                >
                  <option value="">Chọn đề thi</option>
                  {exams?.map((exam: any) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title || `Đề thi ${exam.subject.name} lớp ${exam.grade}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {examDetails && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tên học sinh (tùy chọn)
                  </label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="input"
                    placeholder="Nhập tên học sinh"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Đáp án</label>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {examDetails.questions
                      ?.sort((a: any, b: any) => a.order - b.order)
                      .map((eq: any) => (
                        <div key={eq.question.id} className="p-3 border border-gray-200 rounded-lg">
                          <p className="text-sm font-medium text-gray-900 mb-2">
                            Câu {eq.order}: {eq.question.content.substring(0, 50)}...
                          </p>
                          {eq.question.type === 'MCQ' && eq.question.options ? (
                            <div className="grid grid-cols-2 gap-2">
                              {(eq.question.options as string[]).map((option: string, idx: number) => (
                                <label key={idx} className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`q-${eq.question.id}`}
                                    value={idx.toString()}
                                    checked={answers[eq.question.id] === idx.toString()}
                                    onChange={(e) =>
                                      setAnswers({ ...answers, [eq.question.id]: e.target.value })
                                    }
                                    className="text-primary-600"
                                  />
                                  <span className="text-sm">
                                    {String.fromCharCode(65 + idx)}. {option}
                                  </span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={answers[eq.question.id] || ''}
                              onChange={(e) =>
                                setAnswers({ ...answers, [eq.question.id]: e.target.value })
                              }
                              className="input text-sm"
                              placeholder="Nhập đáp án"
                            />
                          )}
                        </div>
                      ))}
                  </div>
                </div>

                <button
                  onClick={handleGrade}
                  disabled={gradeMutation.isPending || Object.keys(answers).length === 0}
                  className="w-full btn btn-primary flex items-center justify-center gap-2"
                >
                  {gradeMutation.isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Đang chấm...
                    </>
                  ) : (
                    <>
                      <CheckSquare size={20} />
                      Chấm bài
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: Results */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Kết quả chấm bài</h2>

          {gradingResult ? (
            <div className="space-y-4">
              <div className="p-4 bg-primary-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-primary-600">
                  {gradingResult.score} / {gradingResult.maxScore}
                </p>
                <p className="text-lg text-gray-700 mt-1">
                  {gradingResult.percentage}%
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Chi tiết</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {gradingResult.results.map((result: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg ${
                        result.isCorrect ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {result.isCorrect ? (
                          <CheckCircle className="text-green-600 mt-0.5" size={20} />
                        ) : (
                          <XCircle className="text-red-600 mt-0.5" size={20} />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Câu {idx + 1}
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            Đáp án: {result.studentAnswer} | Đúng: {result.correctAnswer}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Điểm: {result.points} / {result.maxPoints}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              Nhập đáp án và nhấn "Chấm bài" để xem kết quả
            </p>
          )}

          {/* Previous Results */}
          {results && results.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-2">Lịch sử chấm bài</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {results.map((result: any) => (
                  <div key={result.id} className="p-3 border border-gray-200 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">
                      {result.studentName || 'Không tên'}
                    </p>
                    <p className="text-xs text-gray-600">
                      Điểm: {result.score} | {new Date(result.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
