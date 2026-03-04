# HomeHealth AI - Redesign Migration Notes

## Overview

This document outlines the migration from the old multi-step OASIS questionnaire flow to the new audio-first capture + AI extraction workflow.

## New Architecture Summary

### Before (Old Flow)
```
Schedule → Patient Modal → Visit Type Modal → Episode Page
                                                  ├── Prepare Tab (referral docs)
                                                  ├── Visit Tab (manual form entry)
                                                  └── Documentation Tab (OASIS questions)
                                                              └── Transfer to EMR
```

### After (New Flow)
```
Dashboard → Visit Capture Workspace → Review & Approve → Export to EMR
                    │
                    ├── Record audio
                    ├── Upload referral docs
                    ├── AI extracts entities
                    └── AI generates SOAP + EMR field map
```

---

## New Route Map

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | Dashboard | Schedule view + quick start capture |
| `/capture` | VisitCaptureWorkspace | Main recording + extraction screen |
| `/visit/:id/review` | ReviewAndApprove | SOAP editor + EMR field approval |
| `/visit/:id/export` | (part of review) | Export/copy to EMR |
| `/settings` | Settings | EMR template management |

---

## New File Structure

```
Frontend/src/
├── features/
│   ├── capture/
│   │   ├── components/
│   │   │   ├── RecordingControls.tsx      # Record button + timer
│   │   │   ├── ReferralDocsPanel.tsx      # Document upload
│   │   │   ├── ExtractionTimeline.tsx     # Live AI extraction display
│   │   │   ├── EmrTemplatePanel.tsx       # EMR template status
│   │   │   ├── PatientInfoCard.tsx        # Patient summary
│   │   │   └── QuickInputs.tsx            # Time in/out, location
│   │   ├── pages/
│   │   │   └── VisitCaptureWorkspace.tsx  # Main capture page
│   │   └── stores/
│   │       └── captureStore.ts            # Zustand state
│   │
│   ├── review/
│   │   ├── components/
│   │   │   ├── SoapNoteEditor.tsx         # Editable SOAP sections
│   │   │   ├── EmrFieldMap.tsx            # EMR field list with approval
│   │   │   └── ExportPanel.tsx            # Export options modal
│   │   ├── pages/
│   │   │   └── ReviewAndApprove.tsx       # Review page
│   │   └── utils/
│   │       └── exportUtils.ts             # JSON/CSV export functions
│   │
│   └── dashboard/
│       └── pages/
│           └── Dashboard.tsx              # Home/schedule page
│
├── types/
│   └── capture.types.ts                   # New type definitions
│
└── routes/
    └── captureRoutes.tsx                  # New route configuration
```

---

## Files to DELETE (Old Flow)

### Pages (Remove Completely)
```
Frontend/src/pages/episode/
├── EpisodePage.tsx              # Multi-tab container
├── PrepareTab.tsx               # Preparation phase
├── VisitTab.tsx                 # Manual form entry
└── DocumentationTab.tsx         # OASIS questionnaire

Frontend/src/pages/schedule/
└── SchedulePage.tsx             # Old schedule (replace with Dashboard)
```

### Components (Remove Completely)
```
Frontend/src/components/oasis/
├── QuestionRenderer.tsx         # OASIS question input
├── SectionList.tsx              # OASIS section navigation
├── SectionProgress.tsx          # "103 remaining" counters
├── QuestionCard.tsx             # Individual question display
└── ...all OASIS components

Frontend/src/components/forms/
├── VisitFormContainer.tsx       # Canonical form engine UI
├── FormSection.tsx              # Section renderer
├── FormProgressSidebar.tsx      # Progress tracking
├── CanonicalQuestionRenderer.tsx # Question renderer
└── ModuleToggles.tsx            # Module toggles

Frontend/src/components/schedule/
└── NewAssessmentModal.tsx       # Multi-step patient/visit selection
```

### Stores (Remove or Refactor)
```
Frontend/src/context/stores/
├── episodeStore.ts              # Old episode state (replace with captureStore)
├── visitNoteStore.ts            # Old visit note state (integrated into captureStore)
└── oasisStore.ts                # OASIS-specific state (remove)
```

### Services (Remove)
```
Frontend/src/services/
├── formEngine.service.ts        # Canonical form API (remove)
└── emrExport.service.ts         # Old export service (replace with new exportUtils)

Frontend/src/hooks/queries/
├── useFormEngine.ts             # Form engine hooks (remove)
└── useAssessments.ts            # OASIS assessment hooks (refactor or remove)
```

### Backend (Remove)
```
Backend/src/domain/canonical/    # Entire canonical form system
├── formDefinitions.ts
├── formEngine.service.ts
├── questionBank.ts
└── types.ts

Backend/src/routes/
├── formEngine.routes.ts         # Form engine API (remove)
└── ...

Backend/src/controllers/
└── formEngine.controller.ts     # Form engine controller (remove)
```

---

## Files to KEEP (Refactored or Used)

### Patient/Episode Data
```
Frontend/src/hooks/queries/
├── usePatients.ts               # Keep - patient search/lookup
└── useEpisodes.ts               # Keep - episode data

Frontend/src/services/
├── patient.service.ts           # Keep - patient API
└── episode.service.ts           # Keep - episode API
```

### Common Components
```
Frontend/src/components/common/
├── Button.tsx                   # Keep
├── Modal.tsx                    # Keep
├── Input.tsx                    # Keep
├── Spinner.tsx                  # Keep
└── Badge.tsx                    # Keep
```

### Voice/Recording (Adapt)
```
Frontend/src/hooks/
├── useVoiceRecording.ts         # Adapt for new RecordingControls
└── useProcessVoice.ts           # Adapt for new AI pipeline
```

---

## New Backend APIs Needed

### 1. Audio Processing
```
POST /api/visits/:visitId/audio/upload
POST /api/visits/:visitId/audio/transcribe
POST /api/visits/:visitId/audio/extract
```

### 2. Document Processing
```
POST /api/visits/:visitId/documents/upload
POST /api/visits/:visitId/documents/extract
```

### 3. AI Generation
```
POST /api/visits/:visitId/generate/soap
POST /api/visits/:visitId/generate/emr-map
POST /api/visits/:visitId/generate/all
```

### 4. EMR Template Management
```
GET  /api/emr-templates
POST /api/emr-templates/import
GET  /api/emr-templates/:id
```

### 5. Visit Capture
```
POST /api/captures                    # Start new capture session
GET  /api/captures/:id                # Get capture state
PUT  /api/captures/:id                # Update capture
POST /api/captures/:id/finalize       # Mark as complete
```

---

## Data Model Changes

### New Models (Add)
```typescript
// Recording
model Recording {
  id              String
  visitId         String
  status          RecordingStatus
  durationSeconds Int
  audioUrl        String?
  transcript      Json?    // { segments: [...] }
  extractedAt     DateTime?
}

// VisitCapture (replaces old Visit workflow state)
model VisitCapture {
  id              String
  visitId         String
  patientId       String
  episodeId       String
  status          CaptureStatus
  recording       Recording?
  documents       ReferralDocument[]
  emrTemplateId   String?
  emrAnswerMap    Json?    // { fieldId: value, ... }
  soapNote        Json?    // { subjective, objective, ... }
  extractedEntities Json?  // { diagnoses, medications, ... }
}

// EmrTemplate
model EmrTemplate {
  id          String
  name        String
  vendor      String
  version     String
  visitType   String
  discipline  String
  fields      Json     // Array of EmrField
}
```

### Remove
- All OASIS-specific response storage (replaced by EmrAnswerMap)
- Canonical form engine models

---

## Migration Steps

### Phase 1: Add New Code (Non-Breaking)
1. Add new `features/` directory structure
2. Add new types (`capture.types.ts`)
3. Add new stores (`captureStore.ts`)
4. Add new pages (Dashboard, VisitCaptureWorkspace, ReviewAndApprove)
5. Add new routes (`captureRoutes.tsx`)

### Phase 2: Wire Up New Routes
1. Update `App.tsx` to use new routes alongside old routes
2. Add feature flag to toggle between old/new flow
3. Test new flow end-to-end

### Phase 3: Backend APIs
1. Implement audio upload/transcription endpoints
2. Implement document extraction endpoints
3. Implement AI generation endpoints (SOAP, EMR map)
4. Implement EMR template management

### Phase 4: Remove Old Code
1. Remove old episode pages
2. Remove OASIS components
3. Remove canonical form engine
4. Remove old services/hooks
5. Clean up unused backend routes

---

## Feature Flag Recommendation

During migration, use a feature flag to toggle between flows:

```typescript
// In App.tsx or route config
const useNewCaptureFlow = import.meta.env.VITE_USE_NEW_CAPTURE_FLOW === 'true';

if (useNewCaptureFlow) {
  return <CaptureRoutes />;
} else {
  return <LegacyRoutes />;
}
```

---

## Testing Checklist

- [ ] Can start recording from dashboard (1 click)
- [ ] Recording controls work (start/pause/stop)
- [ ] Document upload works
- [ ] AI extraction timeline shows progress
- [ ] SOAP note is generated and editable
- [ ] EMR field map shows all fields with confidence
- [ ] Can filter fields by required/low confidence/empty
- [ ] Can edit individual field values
- [ ] Can approve all fields
- [ ] Export to JSON works
- [ ] Export to CSV works
- [ ] Copy to clipboard works for all sections
- [ ] Mobile responsive layout works
