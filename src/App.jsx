import React, { useEffect, useRef, useState } from 'react';
import './App.css';

const API = 'http://localhost:8080/api/v1/station';
const EMPTY_FORM = { stationName: '', subwayLine: '', location: '' };

async function request(path, options = {}, expectList = true) {
  const response = await fetch(`${API}${path}`, options);
  if (!response.ok) {
    throw new Error(`요청에 실패했습니다. (HTTP ${response.status})`);
  }
  // 등록·수정·삭제 응답에는 JSON 본문이 없어도 된다.
  if (options.method) return;
  const data = await response.json();
  if (expectList && !Array.isArray(data)) throw new Error('서버의 목록 응답 형식을 확인해주세요.');
  return data;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

export default function App() {
  const [stations, setStations] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [keyword, setKeyword] = useState('');
  const [editingStationNo, setEditingStationNo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = useRef(false);
  const nameInput = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    request('/', { signal: controller.signal })
      .then(setStations)
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  function errorMessage(cause) {
    return cause instanceof TypeError
      ? '서버에 연결할 수 없습니다. localhost:8080 서버 실행 및 CORS 설정을 확인해주세요.'
      : cause.message;
  }

  async function run(action) {
    if (busy.current || loading) return;
    busy.current = true;
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  async function loadAll() {
    const data = await request('/');
    setStations(data);
    setKeyword('');
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingStationNo(null);
  }

  async function refreshAfterChange(message) {
    try {
      await loadAll();
      setNotice(message);
    } catch (cause) {
      setStations([]);
      throw new Error(`${message} 목록 갱신에 실패했습니다. 전체보기를 눌러 다시 조회해주세요. ${errorMessage(cause)}`);
    }
  }

  function save(event) {
    event.preventDefault();
    const body = {
      stationName: form.stationName.trim(),
      subwayLine: form.subwayLine.trim(),
      location: form.location.trim(),
    };
    if (!body.stationName || !body.subwayLine || !body.location) {
      setError('역 이름, 노선, 위치를 모두 입력해주세요. 공백만 입력할 수 없습니다.');
      return;
    }
    run(async () => {
      const editing = editingStationNo !== null;
      await request(editing ? `/${editingStationNo}` : '/', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (editing) {
        let saved;
        try {
          saved = await request(`/${editingStationNo}`, { cache: 'no-store' }, false);
        } catch (cause) {
          throw new Error(`수정 요청은 처리되었지만 저장 결과를 확인하지 못했습니다. ${errorMessage(cause)}`);
        }
        const fieldNames = { stationName: '역 이름', subwayLine: '노선', location: '위치' };
        const unsaved = [];
        for (const field of Object.keys(body)) {
          if (saved?.[field] !== body[field]) unsaved.push(fieldNames[field]);
        }
        if (unsaved.length) {
          throw new Error(`${unsaved.join(', ')} 값이 서버에 반영되지 않았습니다. 백엔드 수정 API의 저장 처리를 확인해주세요. 입력값은 유지됩니다.`);
        }
      }
      resetForm();
      await refreshAfterChange(editing ? '수정했습니다.' : '등록했습니다.');
    });
  }

  function search(event) {
    event.preventDefault();
    const value = keyword.trim();
    if (!value) {
      window.alert('검색어를 입력해주세요.');
      return;
    }
    run(async () => {
      const data = await request(`/search?${new URLSearchParams({ keyword: value })}`);
      setStations(data);
      setNotice(`“${value}” 검색 결과 ${data.length}개`);
    });
  }

  function edit(station) {
    setEditingStationNo(station.stationNo);
    setForm({
      stationName: station.stationName ?? '',
      subwayLine: station.subwayLine ?? '',
      location: station.location ?? '',
    });
    setError('');
    setNotice('');
    nameInput.current?.focus();
  }

  function remove(stationNo) {
    if (!window.confirm('삭제하시겠습니까?')) return;
    run(async () => {
      await request(`/${stationNo}`, { method: 'DELETE' });
      if (editingStationNo === stationNo) resetForm();
      await refreshAfterChange('삭제했습니다.');
    });
  }

  return (
    <main className="app">
      <header className="page-header">
        <div className="brand-mark" aria-hidden="true">S</div>
        <div><p className="eyebrow">STATION MANAGEMENT</p><h1>지하철역 관리</h1></div>
        <span className="header-tag">역 정보 관리</span>
      </header>

      <section className="panel" aria-labelledby="form-title">
        <div className="section-heading">
          <div><p className="eyebrow">01 / STATION INFO</p><h2 id="form-title">{editingStationNo !== null ? '역 정보 수정' : '새로운 역 등록'}</h2></div>
          <span className="hint">{editingStationNo !== null ? `번호 ${editingStationNo} 수정 중` : '모든 항목은 필수 입력입니다'}</span>
        </div>
        <form onSubmit={save}>
          <fieldset disabled={loading}>
            <div className="fields">
              <label>역 이름<input ref={nameInput} name="stationName" value={form.stationName} onChange={(e) => setForm({ ...form, stationName: e.target.value })} placeholder="예: 역삼역" required /></label>
              <label>노선<input name="subwayLine" value={form.subwayLine} onChange={(e) => setForm({ ...form, subwayLine: e.target.value })} placeholder="예: 2호선" required /></label>
              <label>위치<input name="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="예: 서울특별시 강남구" required /></label>
            </div>
            <div className="form-actions">
              {editingStationNo !== null && <button type="button" className="secondary" onClick={resetForm}>취소</button>}
              <button type="submit">{editingStationNo !== null ? '수정 완료' : '등록'}</button>
            </div>
          </fieldset>
        </form>
      </section>

      <div className="messages" aria-live="polite">
        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
      </div>

      <section className="panel list-panel" aria-labelledby="list-title" aria-busy={loading}>
        <div className="section-heading"><div><p className="eyebrow">02 / STATION LIST</p><h2 id="list-title">역 목록 <span className="count">{stations.length}</span></h2></div></div>
        <form className="search-form" onSubmit={search}>
          <label className="search-field"><span className="sr-only">검색어</span><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="역 이름, 노선, 위치로 검색" disabled={loading} /></label>
          <button type="submit" disabled={loading}>검색</button>
          <button type="button" className="secondary" disabled={loading} onClick={() => run(loadAll)}>전체보기</button>
        </form>
        {loading && <p className="loading" role="status">처리 중입니다…</p>}
        <div className="table-scroll" tabIndex="0" role="region" aria-label="역 목록 표">
          <table>
            <thead><tr><th scope="col">번호</th><th scope="col">역명</th><th scope="col">노선</th><th scope="col">위치</th><th scope="col">등록일</th><th scope="col">관리</th></tr></thead>
            <tbody>
              {stations.map((station) => <tr key={station.stationNo} className={editingStationNo === station.stationNo ? 'editing' : ''}>
                <td className="station-no">{station.stationNo}</td><td className="station-name">{station.stationName}</td><td><span className="line-badge">{station.subwayLine}</span></td><td>{station.location}</td><td className="date">{formatDate(station.ctime)}</td>
                <td><div className="row-actions"><button type="button" className="edit-button" disabled={loading} onClick={() => edit(station)} aria-label={`${station.stationName} 수정`}>수정</button><button type="button" className="delete-button" disabled={loading} onClick={() => remove(station.stationNo)} aria-label={`${station.stationName} 삭제`}>삭제</button></div></td>
              </tr>)}
              {!loading && stations.length === 0 && <tr><td colSpan="6" className="empty">{error ? '목록을 불러오지 못했습니다. 전체보기를 눌러 다시 시도해주세요.' : '표시할 역이 없습니다. 역을 등록하거나 다른 검색어를 입력해주세요.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="list-footer">역 정보는 서버에서 제공하는 순서로 표시됩니다.</footer>
      </section>
    </main>
  );
}
