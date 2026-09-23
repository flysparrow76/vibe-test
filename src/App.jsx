import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

const API = import.meta.env.VITE_STATION_API_URL || 'http://localhost:8080/api/v1/station';
const EMPTY_FORM = { stationName: '', subwayLine: '', location: '', latitude: '', longitude: '' };
const PAGE_SIZE = 10;
const LINE_COLORS = ['#0052a4', '#00a84d', '#ef7c1c', '#00a5de', '#996cac', '#cd7c2f', '#747f00', '#e6186c', '#a49e89'];

function hasCoordinates(station) {
  return Number.isFinite(station.latitude) && Number.isFinite(station.longitude)
    && Math.abs(station.latitude) <= 90 && Math.abs(station.longitude) <= 180;
}

function StationMap({ stations }) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef(null);
  const bounds = useRef(null);
  const [tileError, setTileError] = useState(false);
  let mappedCount = 0;
  for (const station of stations) if (hasCoordinates(station)) mappedCount++;

  useEffect(() => {
    const instance = L.map(container.current).setView([37.5665, 126.978], 11);
    map.current = instance;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).on('tileerror', () => setTileError(true)).addTo(instance);
    markers.current = L.featureGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    markers.current.clearLayers();
    const coordinates = [];
    for (const station of stations) {
      if (!hasCoordinates(station)) continue;
      const position = [station.latitude, station.longitude];
      coordinates.push(position);
      const line = station.subwayLine?.match(/([1-9])호선/)?.[1];
      const icon = L.divIcon({
        className: 'station-pin',
        html: `<span style="background:${LINE_COLORS[Number(line) - 1] || '#146b55'}">${line || 'S'}</span>`,
        iconSize: [24, 24], iconAnchor: [12, 12],
      });
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = station.stationName;
      const detail = document.createElement('p');
      detail.textContent = `${station.subwayLine || ''} · ${station.location || '주소 미등록'}`;
      popup.append(title, detail);
      L.marker(position, { icon, title: station.stationName, alt: station.stationName })
        .bindPopup(popup).addTo(markers.current);
    }
    bounds.current = coordinates.length ? L.latLngBounds(coordinates) : null;
    if (bounds.current) map.current.fitBounds(bounds.current, { padding: [30, 30], maxZoom: 14 });
  }, [stations]);

  return <section className="panel map-panel" aria-labelledby="map-title">
    <div className="section-heading">
      <div><p className="eyebrow">03 / STATION MAP</p><h2 id="map-title">전체 역 지도 <span className="count">{mappedCount}</span></h2></div>
      <button type="button" className="secondary" disabled={!mappedCount} onClick={() => map.current.fitBounds(bounds.current, { padding: [30, 30], maxZoom: 14 })}>전체 역 보기</button>
    </div>
    <p className="map-description">검색·페이지와 관계없이 좌표가 등록된 모든 역을 표시합니다. 지도를 움직이거나 확대하고 역을 눌러보세요.</p>
    <div className="line-legend">{LINE_COLORS.map((color, index) => <span key={color}><i style={{ background: color }} />{index + 1}호선</span>)}</div>
    {mappedCount < stations.length && <p className="map-warning" role="status">좌표가 없는 역 {stations.length - mappedCount}개는 지도에 표시할 수 없습니다. 역 수정에서 위도·경도를 입력해주세요.</p>}
    {!stations.length && <p className="map-warning">표시할 역이 없습니다. 서버 연결 및 역 데이터 등록 상태를 확인해주세요.</p>}
    {tileError && <p className="map-warning" role="status">지도 배경을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해주세요.</p>}
    <div ref={container} className="station-map" aria-label="전체 지하철역 지도" />
    <p className="list-footer">역 좌표 출처: <a href="https://data.seoul.go.kr/dataList/OA-21232/S/1/datasetView.do" target="_blank" rel="noreferrer">서울시 역사마스터 정보</a> · 환승역은 대표 좌표에 하나의 마커로 표시합니다.</p>
  </section>;
}

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
  const [allStations, setAllStations] = useState([]);
  const [page, setPage] = useState(1);
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
      .then((data) => { setStations(data); setAllStations(data); })
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
    setAllStations(data);
    setPage(1);
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
      setAllStations([]);
      setPage(1);
      throw new Error(`${message} 목록 갱신에 실패했습니다. 전체보기를 눌러 다시 조회해주세요. ${errorMessage(cause)}`);
    }
  }

  function save(event) {
    event.preventDefault();
    const body = {
      stationName: form.stationName.trim(),
      subwayLine: form.subwayLine.trim(),
      location: form.location.trim(),
      latitude: form.latitude === '' ? null : Number(form.latitude),
      longitude: form.longitude === '' ? null : Number(form.longitude),
    };
    if (!body.stationName || !body.subwayLine || !body.location) {
      setError('역 이름, 노선, 위치를 모두 입력해주세요. 공백만 입력할 수 없습니다.');
      return;
    }
    if ((body.latitude !== null || body.longitude !== null) && !hasCoordinates(body)) {
      setError('위도(-90~90)와 경도(-180~180)를 모두 입력하거나 모두 비워주세요.');
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
        const fieldNames = { stationName: '역 이름', subwayLine: '노선', location: '위치', latitude: '위도', longitude: '경도' };
        const unsaved = [];
        for (const field of Object.keys(body)) {
          if ((saved?.[field] ?? null) !== body[field]) unsaved.push(fieldNames[field]);
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
      setPage(1);
      setNotice(`“${value}” 검색 결과 ${data.length}개`);
    });
  }

  function edit(station) {
    setEditingStationNo(station.stationNo);
    setForm({
      stationName: station.stationName ?? '',
      subwayLine: station.subwayLine ?? '',
      location: station.location ?? '',
      latitude: station.latitude ?? '',
      longitude: station.longitude ?? '',
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

  const pageCount = Math.max(1, Math.ceil(stations.length / PAGE_SIZE));
  const visibleStations = stations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageStart = Math.floor((page - 1) / 5) * 5 + 1;

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
          <span className="hint">{editingStationNo !== null ? `번호 ${editingStationNo} 수정 중` : '역 이름·노선·위치는 필수 입력입니다'}</span>
        </div>
        <form onSubmit={save}>
          <fieldset disabled={loading}>
            <div className="fields">
              <label>역 이름<input ref={nameInput} name="stationName" value={form.stationName} onChange={(e) => setForm({ ...form, stationName: e.target.value })} placeholder="예: 역삼역" required /></label>
              <label>노선<input name="subwayLine" value={form.subwayLine} onChange={(e) => setForm({ ...form, subwayLine: e.target.value })} placeholder="예: 2호선" required /></label>
              <label>위치<input name="location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="예: 서울특별시 강남구" required /></label>
            </div>
            <details className="coordinate-fields">
              <summary>지도 좌표 (선택)</summary>
              <div className="fields">
                <label>위도<input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="예: 37.500622" /></label>
                <label>경도<input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="예: 127.036456" /></label>
              </div>
            </details>
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
              {visibleStations.map((station) => <tr key={station.stationNo} className={editingStationNo === station.stationNo ? 'editing' : ''}>
                <td className="station-no">{station.stationNo}</td><td className="station-name">{station.stationName}</td><td><span className="line-badge">{station.subwayLine}</span></td><td>{station.location}</td><td className="date">{formatDate(station.ctime)}</td>
                <td><div className="row-actions"><button type="button" className="edit-button" disabled={loading} onClick={() => edit(station)} aria-label={`${station.stationName} 수정`}>수정</button><button type="button" className="delete-button" disabled={loading} onClick={() => remove(station.stationNo)} aria-label={`${station.stationName} 삭제`}>삭제</button></div></td>
              </tr>)}
              {!loading && stations.length === 0 && <tr><td colSpan="6" className="empty">{error ? '목록을 불러오지 못했습니다. 전체보기를 눌러 다시 시도해주세요.' : '표시할 역이 없습니다. 역을 등록하거나 다른 검색어를 입력해주세요.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <nav className="pagination" aria-label="역 목록 페이지">
          <button type="button" className="secondary" disabled={loading || page === 1} onClick={() => setPage(1)} aria-label="첫 페이지">«</button>
          <button type="button" className="secondary" disabled={loading || page === 1} onClick={() => setPage(page - 1)}>이전</button>
          {Array.from({ length: Math.min(5, pageCount - pageStart + 1) }, (_, index) => pageStart + index).map((number) => <button type="button" key={number} className={page === number ? '' : 'secondary'} aria-current={page === number ? 'page' : undefined} disabled={loading} onClick={() => setPage(number)}>{number}</button>)}
          <button type="button" className="secondary" disabled={loading || page === pageCount} onClick={() => setPage(page + 1)}>다음</button>
          <button type="button" className="secondary" disabled={loading || page === pageCount} onClick={() => setPage(pageCount)} aria-label="마지막 페이지">»</button>
        </nav>
        <footer className="list-footer">총 {stations.length}개 · {page} / {pageCount}페이지 · 페이지당 10개 · 서버에서 제공하는 순서로 표시합니다.</footer>
      </section>
      <StationMap stations={allStations} />
    </main>
  );
}
