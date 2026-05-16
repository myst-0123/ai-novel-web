import { useState } from 'react';

export function useUploadForm() {
  const [password, setPassword] = useState('');
  const [type, setType] = useState('single');
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [seriesName, setSeriesName] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!file) return setError('HTMLファイルを選択してください');
    if (!password) return setError('パスワードを入力してください');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    formData.append('type', type);

    if (type === 'single') {
      formData.append('title', title.trim());
    } else {
      formData.append('seriesName', seriesName.trim());
      formData.append('episodeTitle', episodeTitle.trim());
      formData.append('episodeNumber', episodeNumber);
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'アップロードに失敗しました');
      } else {
        setSuccess(`アップロード完了: ${data.path}`);
        setFile(null);
        setTitle('');
        setSeriesName('');
        setEpisodeTitle('');
        setEpisodeNumber('');
        const fileInput = document.getElementById('upload-file-input');
        if (fileInput) fileInput.value = '';
      }
    } catch {
      setError('ネットワークエラーが発生しました');
    } finally {
      setSubmitting(false);
    }
  };

  return {
    password, setPassword,
    type, setType,
    file, setFile,
    title, setTitle,
    seriesName, setSeriesName,
    episodeTitle, setEpisodeTitle,
    episodeNumber, setEpisodeNumber,
    submitting,
    error, setError,
    success,
    handleSubmit,
  };
}
