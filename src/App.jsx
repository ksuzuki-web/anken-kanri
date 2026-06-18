import React, { useState, useEffect, useMemo, useCallback } from 'react'
import KanbanColumn from './components/KanbanColumn'
import CandidateModal from './components/CandidateModal'
import ClosedSection from './components/ClosedSection'
import { KANBAN_COLUMNS, CLOSED_STATUSES, STATUS_MAP, CA_MEMBERS } from './constants'
import { evaluateAlert } from './alerts'
import {
  loadCandidates,
  createCandidate,
  updateCandidate,
  deleteCandidate,
  subscribeToChanges,
  generateId,
} from './storage'

export default function App() {
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [caFilter, setCaFilter] = useState('all')
  const [alertOnly, setAlertOnly] = useState(false)
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const data = await loadCandidates()
      setCandidates(data)
      setLoadError(null)
    } catch (e) {
      console.error(e)
      setLoadError('データの読み込みに失敗しました。接続設定（.env）を確認してください。')
    } finally {
      setLoading(false)
    }
  }, [])

  // 初回読み込み
  useEffect(() => {
    refresh()
  }, [refresh])

  // 他の人がデータを変更したら自動で再読み込みする（リアルタイム共有）
  useEffect(() => {
    const unsubscribe = subscribeToChanges(() => {
      refresh()
    })
    return () => unsubscribe()
  }, [refresh])

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (caFilter !== 'all' && c.assignedCA !== caFilter) return false
      if (alertOnly && !evaluateAlert(c).isAlert) return false
      return true
    })
  }, [candidates, caFilter, alertOnly])

  const alertCount = useMemo(() => candidates.filter((c) => evaluateAlert(c).isAlert).length, [candidates])

  function openNew() {
    setSelected(null)
    setShowModal(true)
  }

  function openEdit(candidate) {
    setSelected(candidate)
    setShowModal(true)
  }

  async function handleSave(record, isNew) {
    setSaving(true)
    try {
      if (isNew) {
        const created = await createCandidate({ ...record, id: generateId() })
        setCandidates((prev) => [...prev, created])
      } else {
        const updated = await updateCandidate(record)
        setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      }
      setShowModal(false)
    } catch (e) {
      window.alert('保存に失敗しました。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    setSaving(true)
    try {
      await deleteCandidate(id)
      setCandidates((prev) => prev.filter((c) => c.id !== id))
      setShowModal(false)
    } catch (e) {
      window.alert('削除に失敗しました。もう一度お試しください。')
    } finally {
      setSaving(false)
    }
  }

  const closedCandidates = filtered.filter((c) => CLOSED_STATUSES.includes(c.status))

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)', fontSize: '14px' }}>
        読み込み中…
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '24px' }}>
        <div style={{ maxWidth: '420px', textAlign: 'center', color: 'var(--danger-text)', fontSize: '14px' }}>
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'var(--navy-900)',
          color: '#fff',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>案件管理</div>
          <div style={{ fontSize: '11px', color: 'var(--gold-100)' }}>宅建Jobエージェント ユニット管理ボード</div>
        </div>
        <button
          onClick={openNew}
          disabled={saving}
          style={{
            background: 'var(--gold-500)',
            color: 'var(--navy-900)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          ＋ 候補者を追加
        </button>
      </header>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '12px 24px',
          background: '#fff',
          borderBottom: '1px solid var(--border-default)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>担当CA</label>
          <select
            value={caFilter}
            onChange={(e) => setCaFilter(e.target.value)}
            style={{
              fontSize: '13px',
              padding: '6px 8px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
            }}
          >
            <option value="all">全員</option>
            {CA_MEMBERS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={alertOnly} onChange={(e) => setAlertOnly(e.target.checked)} />
          要注意のみ表示
        </label>

        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)' }}>
          全{candidates.length}件
          {alertCount > 0 && (
            <span style={{ color: 'var(--danger-text)', fontWeight: 600, marginLeft: '8px' }}>
              ⚠ 要注意 {alertCount}件
            </span>
          )}
        </div>
      </div>

      <main style={{ flex: 1, padding: '20px 24px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: '14px' }}>
          {KANBAN_COLUMNS.map((statusKey) => (
            <KanbanColumn
              key={statusKey}
              statusKey={statusKey}
              label={STATUS_MAP[statusKey].label}
              candidates={filtered.filter((c) => c.status === statusKey)}
              onCardClick={openEdit}
            />
          ))}
        </div>

        <ClosedSection candidates={closedCandidates} onCardClick={openEdit} />
      </main>

      {showModal && (
        <CandidateModal
          candidate={selected}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
