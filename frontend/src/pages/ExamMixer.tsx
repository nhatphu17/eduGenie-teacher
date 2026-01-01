import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { Shuffle, Download, FileText, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function ExamMixer() {
  const [selectedExamId, setSelectedExamId] = useState('');
  const [numberOfVersions, setNumberOfVersions] = useState(4);
  const [mixedVersions, setMixedVersions] = useState<any>(null);

  // Get exams
  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/exams`);
      return res.data;
    },
  });

  const mixMutation = useMutation({
    mutationFn: async ({ examId, versions }: { examId: string; versions: number }) => {
      const res = await axios.post(`${API_URL}/exams/${examId}/mix`, {
        numberOfVersions: versions,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setMixedVersions(data);
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Trộn đề thất bại');
    },
  });

  const handleMix = () => {
    if (!selectedExamId) {
      alert('Vui lòng chọn đề thi');
      return;
    }
    mixMutation.mutate({ examId: selectedExamId, versions: numberOfVersions });
  };

  const handleExport = (examId: string, format: string) => {
    window.open(`${API_URL}/export/exam/${examId}/${format}`, '_blank');
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Trộn đề thi</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Select Exam */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Chọn đề thi</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Đề thi</label>
              {isLoading ? (
                <p className="text-gray-500">Đang tải...</p>
              ) : (
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Số mã đề (2-10)
              </label>
              <input
                type="number"
                min={2}
                max={10}
                value={numberOfVersions}
                onChange={(e) => setNumberOfVersions(parseInt(e.target.value) || 4)}
                className="input"
              />
            </div>

            <button
              onClick={handleMix}
              disabled={!selectedExamId || mixMutation.isPending}
              className="w-full btn btn-primary flex items-center justify-center gap-2"
            >
              {mixMutation.isPending ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Đang trộn đề...
                </>
              ) : (
                <>
                  <Shuffle size={20} />
                  Trộn đề thi
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Kết quả trộn đề</h2>

          {!mixedVersions ? (
            <p className="text-gray-500 text-center py-8">
              Chọn đề thi và nhấn "Trộn đề thi" để tạo các mã đề
            </p>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="font-medium text-gray-900">
                  {mixedVersions.originalExam.title || 'Đề thi'}
                </p>
                <p className="text-sm text-gray-600">
                  {mixedVersions.originalExam.subject} - Lớp {mixedVersions.originalExam.grade}
                </p>
              </div>

              <div className="space-y-3">
                {mixedVersions.versions.map((version: any, idx: number) => (
                  <div key={idx} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{version.versionCode}</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleExport(mixedVersions.originalExam.id, 'word')}
                          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                          <Download size={16} />
                          Word
                        </button>
                        <button
                          onClick={() => handleExport(mixedVersions.originalExam.id, 'pdf')}
                          className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                          <Download size={16} />
                          PDF
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">
                      {version.questions.length} câu hỏi
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
