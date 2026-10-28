// AG Grid v33's modular architecture requires modules to be registered before
// the first grid mounts, or AgGridReact throws "No AG Grid modules are
// registered!" at runtime. Import this file (for its side effect only) once,
// before rendering <AgGridReact>. Shared by every Report Builder page —
// ModuleRegistry.registerModules is idempotent, so importing it from more
// than one page is safe.
//
// Registering only the specific modules the report builder actually uses
// (rather than AllEnterpriseModule, which also pulls in charting,
// sparklines, the server-side row model, master/detail, etc.) keeps this
// out of the app's initial bundle and shrinks the lazy-loaded chunk this
// page pulls in — most of what AllEnterpriseModule includes was dead
// weight here. If a future report builder feature needs another module
// (e.g. SetFilterModule for per-column filters), add it explicitly rather
// than reaching back for AllEnterpriseModule.
import { ClientSideRowModelModule, CsvExportModule, ModuleRegistry } from "ag-grid-community";
import { AggregationModule, ExcelExportModule, RowGroupingModule, StatusBarModule } from "ag-grid-enterprise";

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  CsvExportModule,
  RowGroupingModule,
  AggregationModule,
  ExcelExportModule,
  StatusBarModule,
]);
