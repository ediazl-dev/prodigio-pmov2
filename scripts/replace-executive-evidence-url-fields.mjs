import fs from "node:fs";

const path = "/home/ubuntu/prodigio-pmo/client/src/pages/stages/ExecutiveDashboardV2.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceLabelContaining(token, replacement) {
  const tokenIndex = source.indexOf(token);
  if (tokenIndex < 0) throw new Error(`No se encontró el campo esperado: ${token}`);
  const labelStart = source.lastIndexOf("<label>", tokenIndex);
  const labelEnd = source.indexOf("</label>", tokenIndex);
  if (labelStart < 0 || labelEnd < 0) throw new Error(`No se pudo delimitar la etiqueta: ${token}`);
  source = `${source.slice(0, labelStart)}${replacement}${source.slice(labelEnd + "</label>".length)}`;
}

replaceLabelContaining(
  "value={acceptanceForm.evidenceUrl}",
  `<label>Acta de aceptación (PDF, máx. 25 MB)<input required type="file" accept={executiveEvidenceAccept.acceptance} onChange={(event) => void uploadSelectedEvidence("acceptance", event.target.files?.[0], (uploaded) => setAcceptanceForm({ ...acceptanceForm, evidenceFileName: uploaded.fileName, evidenceUrl: uploaded.fileUrl }))} /></label>{acceptanceForm.evidenceUrl ? <p className="edv2-note"><b>Archivo validado:</b> {acceptanceForm.evidenceFileName}. El acta aún debe registrarse con fecha y hito.</p> : <p className="edv2-note">Selecciona el acta real. La carga por sí sola no acredita el hito.</p>}{evidenceUploadError ? <p role="alert" className="edv2-note" style={{ color: "#A8272B" }}>{evidenceUploadError}</p> : null}{evidenceUploadNotice ? <p className="edv2-note" style={{ color: "#007A70" }}>{evidenceUploadNotice}</p> : null}`,
);
replaceLabelContaining(
  "value={minuteForm.fileUrl}",
  `<label>Documento de minuta (${`{executiveEvidenceFormatLabel("minute")}`}, máx. 25 MB)<input required type="file" accept={executiveEvidenceAccept.minute} onChange={(event) => void uploadSelectedEvidence("minute", event.target.files?.[0], (uploaded) => setMinuteForm({ ...minuteForm, fileName: uploaded.fileName, fileUrl: uploaded.fileUrl }))} /></label>{minuteForm.fileUrl ? <p className="edv2-note"><b>Archivo validado:</b> {minuteForm.fileName}. Revisa los datos antes de registrar la minuta.</p> : <p className="edv2-note">Carga el documento fuente; no se acredita cobertura hasta su registro y revisión.</p>}{evidenceUploadError ? <p role="alert" className="edv2-note" style={{ color: "#A8272B" }}>{evidenceUploadError}</p> : null}{evidenceUploadNotice ? <p className="edv2-note" style={{ color: "#007A70" }}>{evidenceUploadNotice}</p> : null}`,
);
replaceLabelContaining(
  "value={recoveryPlanForm.fileUrl}",
  `<label>Documento PRD (${`{executiveEvidenceFormatLabel("recovery_plan")}`}, máx. 25 MB)<input required type="file" accept={executiveEvidenceAccept.recovery_plan} onChange={(event) => void uploadSelectedEvidence("recovery_plan", event.target.files?.[0], (uploaded) => setRecoveryPlanForm({ ...recoveryPlanForm, fileName: uploaded.fileName, fileUrl: uploaded.fileUrl, fileSha256: uploaded.sha256 }))} /></label>{recoveryPlanForm.fileUrl ? <p className="edv2-note"><b>Archivo validado:</b> {recoveryPlanForm.fileName}. La aprobación de Delivery sigue siendo obligatoria.</p> : <p className="edv2-note">Carga el PRD real; no se vuelve vigente sólo por almacenarlo.</p>}{evidenceUploadError ? <p role="alert" className="edv2-note" style={{ color: "#A8272B" }}>{evidenceUploadError}</p> : null}{evidenceUploadNotice ? <p className="edv2-note" style={{ color: "#007A70" }}>{evidenceUploadNotice}</p> : null}`,
);

replaceLabelContaining(
  "value={minuteForm.fileName}",
  `<label>Archivo cargado<input required readOnly value={minuteForm.fileName} placeholder="Se completa al validar el archivo" /></label>`,
);
replaceLabelContaining(
  "value={recoveryPlanForm.fileName}",
  `<label>Archivo cargado<input required readOnly value={recoveryPlanForm.fileName} placeholder="Se completa al validar el archivo" /></label>`,
);

fs.writeFileSync(path, source);
