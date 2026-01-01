import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Upload, FileText, BookOpen, X, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function Documents() {
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedType, setSelectedType] = useState('TEXTBOOK');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const queryClient = useQueryClient();

  // Get subjects
  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      // This would need a subjects endpoint, for now return mock
      return [
        { id: '1', name: 'Toán', grade: 6 },
        { id: '2', name: 'Toán', grade: 7 },
        { id: '3', name: 'Ngữ văn', grade: 6 },
      ];
    },
  });

  // Get documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', selectedSubject],
    queryFn: async () => {
      if (!selectedSubject) return [];
      const res = await axios.get(`${API_URL}/documents`, {
        params: { subjectId: selectedSubject },
      });
      return res.data;
    },
    enabled: !!selectedSubject,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await axios.post(`${API_URL}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setFile(null);
      setSelectedSubject('');
      alert('Tải lên tài liệu thành công!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Tải lên thất bại');
    },
  });

  const handleUpload = async () => {
    if (!file || !selectedSubject) {
      alert('Vui lòng chọn file và môn học');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', selectedType);
    formData.append('subjectId', selectedSubject);

    setUploading(true);
    try {
      await uploadMutation.mutateAsync(formData);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Quản lý tài liệu</h1>
      </div>

      {/* Upload Section */}
      <div className="card mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Tải lên tài liệu mới</h2>
        <p className="text-sm text-gray-600 mb-4">
          Tải lên sách giáo khoa, tài liệu giảng dạy để AI có thể sử dụng làm nguồn tạo đề thi và giáo án
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Môn học</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="input"
            >
              <option value="">Chọn môn học</option>
              {subjects?.map((subject: any) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} - Lớp {subject.grade}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loại tài liệu</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="input"
            >
              <option value="TEXTBOOK">Sách giáo khoa</option>
              <option value="TEACHER_MATERIAL">Tài liệu giảng dạy</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">File (Word, Excel, hoặc Text)</label>
            <div className="mt-1 flex items-center gap-4">
              <label className="cursor-pointer">
                <span className="btn btn-secondary flex items-center gap-2">
                  <Upload size={20} />
                  Chọn file
                </span>
                <input
                  type="file"
                  accept=".doc,.docx,.xls,.xlsx,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
              {file && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <FileText size={16} />
                  <span>{file.name}</span>
                  <button
                    onClick={() => setFile(null)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || !selectedSubject || uploading}
            className="btn btn-primary"
          >
            {uploading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Đang tải lên...
              </>
            ) : (
              'Tải lên tài liệu'
            )}
          </button>
        </div>
      </div>

      {/* Documents List */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Tài liệu đã tải lên</h2>

        {!selectedSubject ? (
          <p className="text-gray-500 text-center py-8">Vui lòng chọn môn học để xem tài liệu</p>
        ) : isLoading ? (
          <p className="text-gray-500 text-center py-8">Đang tải...</p>
        ) : documents?.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Chưa có tài liệu nào</p>
        ) : (
          <div className="space-y-3">
            {documents?.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <BookOpen className="text-primary-600" size={24} />
                  <div>
                    <p className="font-medium text-gray-900">{doc.originalFileName || 'Tài liệu'}</p>
                    <p className="text-sm text-gray-500">
                      {doc.type} • {doc.chunkIndex !== null ? `Chunk ${doc.chunkIndex + 1}` : 'Đã xử lý'}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(doc.createdAt).toLocaleDateString('vi-VN')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

