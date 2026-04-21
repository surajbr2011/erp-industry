$base = "http://localhost:5000"
$p = 0; $f = 0; $fl = @()

function Req($meth, $url, $body, $hdrs) {
    $pm = @{Method=$meth; Uri=$url; UseBasicParsing=$true; ErrorAction="SilentlyContinue"}
    if ($body) { $pm.Body = ($body | ConvertTo-Json -Depth 5); $pm.ContentType = "application/json" }
    if ($hdrs) { $pm.Headers = $hdrs }
    try { Invoke-WebRequest @pm } catch { $_.Exception.Response }
}
function SC($r) {
    if ($r.StatusCode -is [int]) { [int]$r.StatusCode }
    elseif ($null -ne $r.StatusCode) { [int][System.Net.HttpStatusCode]$r.StatusCode }
    else { 0 }
}
function T($id, $desc, $meth, $url, $body, $hdrs, $want) {
    $r = Req $meth $url $body $hdrs
    $sc = SC $r
    $ok = $sc -eq $want
    if ($ok) { $global:p++ } else { $global:f++; $global:fl += "$id | $desc | got:$sc want:$want" }
    $sym = if ($ok) { "PASS" } else { "FAIL" }
    $col = if ($ok) { "Green" } else { "Red" }
    Write-Host "  [$sym] $id  $desc  [$sc]" -ForegroundColor $col
    $r
}
function J($r) { try { $r.Content | ConvertFrom-Json } catch { $null } }

$ts = [int](Get-Date -UFormat %s)
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "  TRINIX ERP - FULL MANUAL TEST SUITE  " -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# ── HEALTH ────────────────────────────────────────────────────────────────────
Write-Host "`n[HEALTH]" -ForegroundColor Yellow
T "HC-001" "Health endpoint" "GET" "$base/health" $null $null 200

# ── AUTH ──────────────────────────────────────────────────────────────────────
Write-Host "`n[AUTH]" -ForegroundColor Yellow
$AT   = (J(T "AUTH-001" "Admin login"      "POST" "$base/api/auth/login" @{email="admin@trinixerp.com";password="Password@123"} $null 200)).token
$PT   = (J(T "AUTH-002" "Purchase login"   "POST" "$base/api/auth/login" @{email="purchase@trinixerp.com";password="Password@123"} $null 200)).token
$ProdT= (J(T "AUTH-003" "Production login" "POST" "$base/api/auth/login" @{email="production@trinixerp.com";password="Password@123"} $null 200)).token
$QT   = (J(T "AUTH-004" "Quality login"    "POST" "$base/api/auth/login" @{email="quality@trinixerp.com";password="Password@123"} $null 200)).token
$OT   = (J(T "AUTH-005" "Operator login"   "POST" "$base/api/auth/login" @{email="operator@trinixerp.com";password="Password@123"} $null 200)).token
T "AUTH-006" "Wrong password -> 401"  "POST" "$base/api/auth/login" @{email="admin@trinixerp.com";password="WRONG"} $null 401
T "AUTH-007" "No token -> 401"        "GET"  "$base/api/auth/me" $null $null 401
T "AUTH-008" "Get /me (admin)"        "GET"  "$base/api/auth/me" $null @{Authorization="Bearer $AT"} 200

$AH    = @{Authorization="Bearer $AT"}
$PH    = @{Authorization="Bearer $PT"}
$ProdH = @{Authorization="Bearer $ProdT"}
$QH    = @{Authorization="Bearer $QT"}
$OH    = @{Authorization="Bearer $OT"}

# ── USERS ─────────────────────────────────────────────────────────────────────
Write-Host "`n[USERS]" -ForegroundColor Yellow
T "USR-001" "List users (admin)"         "GET"    "$base/api/users" $null $AH 200
T "USR-002" "List users (purchase->403)" "GET"    "$base/api/users" $null $PH 403
$uid = (J(T "USR-003" "Create user" "POST" "$base/api/users" @{name="QA Bot";email="qa$ts@t.com";password="Test@12345";role="quality_inspector"} $AH 201)).data.id
T "USR-004" "Duplicate email -> 409"     "POST"   "$base/api/users" @{name="Dup";email="qa$ts@t.com";password="Test@12345";role="quality_inspector"} $AH 409
T "USR-005" "Invalid role -> 400"        "POST"   "$base/api/users" @{name="X";email="xx@x.com";password="Test@12345";role="superuser"} $AH 400
if ($uid) {
    T "USR-006" "Update user"            "PUT"    "$base/api/users/$uid" @{name="Updated";email="qa$ts@t.com";role="purchase_manager";department="QA";phone="9000";is_active=$true} $AH 200
    T "USR-007" "Deactivate user"        "DELETE" "$base/api/users/$uid" $null $AH 200
}

# ── SUPPLIERS ─────────────────────────────────────────────────────────────────
Write-Host "`n[SUPPLIERS]" -ForegroundColor Yellow
T "SUP-001" "List suppliers"              "GET"  "$base/api/suppliers" $null $AH 200
T "SUP-002" "Search suppliers"            "GET"  "$base/api/suppliers?search=Steel" $null $AH 200
$sid = (J(T "SUP-003" "Create supplier" "POST" "$base/api/suppliers" @{name="QA Supplier";code="SUP-$ts"} $AH 201)).data.id
T "SUP-004" "Duplicate code -> 409"       "POST" "$base/api/suppliers" @{name="Dup";code="SUP-$ts"} $AH 409
T "SUP-005" "Get by ID"                   "GET"  "$base/api/suppliers/$sid" $null $AH 200
T "SUP-006" "Not found -> 404"            "GET"  "$base/api/suppliers/999999" $null $AH 404
T "SUP-007" "Update supplier"             "PUT"  "$base/api/suppliers/$sid" @{name="QA Supplier";rating=4.5;status="active"} $AH 200
T "SUP-008" "Operator create -> 403"      "POST" "$base/api/suppliers" @{name="X";code="X-001"} $OH 403
T "SUP-009" "Export template"             "GET"  "$base/api/suppliers/export/template" $null $AH 200
T "SUP-010" "Export all"                  "GET"  "$base/api/suppliers/export/all" $null $AH 200

# ── MATERIALS ─────────────────────────────────────────────────────────────────
Write-Host "`n[MATERIALS]" -ForegroundColor Yellow
T "MAT-001" "List materials"              "GET"  "$base/api/materials" $null $AH 200
T "MAT-002" "Low stock filter"            "GET"  "$base/api/materials?low_stock=true" $null $AH 200
$mid = (J(T "MAT-003" "Create material" "POST" "$base/api/materials" @{code="MAT-$ts";name="QA Material";category="Steel";unit="kg";unit_cost=50;minimum_stock=10;reorder_point=20} $AH 201)).data.id
T "MAT-004" "Duplicate code -> 409"       "POST" "$base/api/materials" @{code="MAT-$ts";name="Dup";unit="kg"} $AH 409
T "MAT-005" "Get material with batches"   "GET"  "$base/api/materials/$mid" $null $AH 200
T "MAT-006" "Adjust stock +50"            "POST" "$base/api/materials/$mid/adjust-stock" @{adjustment=50;reason="QA test"} $AH 200
T "MAT-007" "Adjust stock negative->500"  "POST" "$base/api/materials/$mid/adjust-stock" @{adjustment=-9999;reason="test"} $AH 500
T "MAT-008" "Batches/all (shadow-fix)"    "GET"  "$base/api/materials/batches/all" $null $AH 200

# ── BOMs ──────────────────────────────────────────────────────────────────────
Write-Host "`n[BOMs]" -ForegroundColor Yellow
$pc = "PROD-$ts"
T "BOM-001" "List BOMs"                   "GET"  "$base/api/boms" $null $AH 200
$bomId = (J(T "BOM-002" "Create BOM" "POST" "$base/api/boms" @{product_name="QA Product";product_code=$pc;version="1.0";items=@();operations=@()} $ProdH 201)).data.id
T "BOM-003" "Duplicate code -> 409"       "POST" "$base/api/boms" @{product_name="Dup";product_code=$pc} $ProdH 409
T "BOM-004" "Get BOM detail"              "GET"  "$base/api/boms/$bomId" $null $AH 200
T "BOM-005" "Operator create -> 403"      "POST" "$base/api/boms" @{product_name="X";product_code="X-$ts"} $OH 403

# ── WORK ORDERS ───────────────────────────────────────────────────────────────
Write-Host "`n[WORK ORDERS]" -ForegroundColor Yellow
T "WO-001" "List work orders"             "GET"  "$base/api/work-orders" $null $AH 200
$woid = (J(T "WO-002" "Create WO" "POST" "$base/api/work-orders" @{product_name="QA Part";product_code=$pc;planned_quantity=10;priority="high";materials=@();operations=@()} $ProdH 201)).data.id
T "WO-003" "Get WO detail"                "GET"  "$base/api/work-orders/$woid" $null $AH 200
T "WO-004" "Transition: pending->in_proc" "PUT"  "$base/api/work-orders/$woid/status" @{status="in_process"} $ProdH 200
T "WO-005" "Bad transition -> 400"        "PUT"  "$base/api/work-orders/$woid/status" @{status="pending"} $ProdH 400
T "WO-006" "Operator can set on_hold"     "PUT"  "$base/api/work-orders/$woid/status" @{status="on_hold"} $OH 200
T "WO-007" "Generate 3 parts"             "POST" "$base/api/work-orders/$woid/generate-parts" @{quantity=3} $ProdH 200
T "WO-008" "Purchase create -> 403"       "POST" "$base/api/work-orders" @{product_name="X";product_code="Y-$ts";planned_quantity=1} $PH 403

# ── MACHINES ──────────────────────────────────────────────────────────────────
Write-Host "`n[MACHINES]" -ForegroundColor Yellow
T "MCH-001" "List + 30d utilization"      "GET"  "$base/api/machines" $null $AH 200
$mchId = (J(T "MCH-002" "Create machine" "POST" "$base/api/machines" @{machine_code="MCH-$ts";name="QA Machine";machine_type="VMC";location="Bay A"} $AH 201)).data.id
T "MCH-003" "Duplicate code -> 409"       "POST" "$base/api/machines" @{machine_code="MCH-$ts";name="Dup";machine_type="CNC"} $AH 409
T "MCH-004" "Get machine + logs"          "GET"  "$base/api/machines/$mchId" $null $AH 200
T "MCH-005" "Logs/all (shadow-fix)"       "GET"  "$base/api/machines/logs/all" $null $AH 200
T "MCH-006" "Quality inspector -> 403"    "POST" "$base/api/machines" @{machine_code="X-$ts";name="X";machine_type="CNC"} $QH 403
T "MCH-007" "Machine not found -> 404"    "GET"  "$base/api/machines/999999" $null $AH 404

# ── PARTS ─────────────────────────────────────────────────────────────────────
Write-Host "`n[PARTS]" -ForegroundColor Yellow
T "PART-001" "List parts"                 "GET"  "$base/api/parts" $null $AH 200
T "PART-002" "Filter by WO"              "GET"  "$base/api/parts?wo_id=$woid" $null $AH 200
T "PART-003" "Trace invalid -> 404"       "GET"  "$base/api/parts/trace/SN-INVALID-99" $null $AH 404

# ── INSPECTIONS ───────────────────────────────────────────────────────────────
Write-Host "`n[INSPECTIONS]" -ForegroundColor Yellow
T "INS-001" "List inspections"            "GET"  "$base/api/inspections" $null $AH 200
T "INS-002" "List inspection plans"       "GET"  "$base/api/inspections/plans/all" $null $AH 200
$i1 = J(T "INS-003" "Create PASS insp" "POST" "$base/api/inspections" @{wo_id=$woid;inspection_type="in_process";quantity_inspected=10;remarks="OK";results=@(@{parameter_name="OD";measured_value=50.0;status="pass"})} $QH 201)
Write-Host "         -> overall_status: $($i1.data.overall_status)" -ForegroundColor DarkGray
$i2 = J(T "INS-004" "Create FAIL insp" "POST" "$base/api/inspections" @{wo_id=$woid;inspection_type="in_process";quantity_inspected=5;remarks="Bad";results=@(@{parameter_name="Length";measured_value=190.0;status="fail"})} $QH 201)
Write-Host "         -> overall_status: $($i2.data.overall_status)" -ForegroundColor DarkGray
$i3 = J(T "INS-005" "Empty results (NaN guard)" "POST" "$base/api/inspections" @{wo_id=$woid;inspection_type="final";quantity_inspected=2;remarks="Q";results=@()} $QH 201)
Write-Host "         -> qty_passed: $($i3.data.quantity_passed)  (must be 0, not NaN)" -ForegroundColor DarkGray
T "INS-006" "Operator create -> 403"      "POST" "$base/api/inspections" @{wo_id=$woid;inspection_type="final";quantity_inspected=1;results=@()} $OH 403
T "INS-007" "Create inspection plan"      "POST" "$base/api/inspections/plans" @{bom_id=$bomId;inspection_type="final";name="QA Plan $ts";items=@(@{parameter_name="OD";parameter_type="dimensional";nominal_value=50;upper_tolerance=0.05;lower_tolerance=-0.05;unit="mm";is_critical=$true})} $QH 201

# ── FINISHED GOODS ────────────────────────────────────────────────────────────
Write-Host "`n[FINISHED GOODS]" -ForegroundColor Yellow
$fgid = (J(T "FG-001" "Add to FG inventory" "POST" "$base/api/finished-goods" @{product_name="QA FG";product_code=$pc;quantity=20;unit="pcs";unit_cost=500;wo_id=$woid} $ProdH 201)).data.id
T "FG-002" "List finished goods"          "GET"  "$base/api/finished-goods" $null $AH 200
T "FG-003" "Dispatch 5 units"             "POST" "$base/api/finished-goods/$fgid/dispatch" @{customer_name="ACME Ltd";quantity=5;dispatch_date=(Get-Date -Format "yyyy-MM-dd")} $ProdH 201
T "FG-004" "Over-dispatch -> 500"         "POST" "$base/api/finished-goods/$fgid/dispatch" @{customer_name="X";quantity=99999;dispatch_date=(Get-Date -Format "yyyy-MM-dd")} $ProdH 500
T "FG-005" "Dispatch logs paginated"      "GET"  "$base/api/finished-goods/dispatches/all" $null $AH 200

# ── REPORTS ───────────────────────────────────────────────────────────────────
Write-Host "`n[REPORTS]" -ForegroundColor Yellow
T "RPT-001" "Dashboard"                   "GET"  "$base/api/reports/dashboard" $null $AH 200
T "RPT-002" "Production (default dates)"  "GET"  "$base/api/reports/production" $null $AH 200
T "RPT-003" "Production (custom dates)"   "GET"  "$base/api/reports/production?from_date=2026-01-01&to_date=2026-04-09" $null $AH 200
T "RPT-004" "Bad date string -> 400"      "GET"  "$base/api/reports/production?from_date=not-a-date" $null $AH 400
T "RPT-005" "Quality report"              "GET"  "$base/api/reports/quality" $null $AH 200
T "RPT-006" "Inventory report"            "GET"  "$base/api/reports/inventory" $null $AH 200
T "RPT-007" "Purchase report"             "GET"  "$base/api/reports/purchase" $null $AH 200
T "RPT-008" "No auth -> 401"              "GET"  "$base/api/reports/dashboard" $null $null 401

# ── SECURITY ──────────────────────────────────────────────────────────────────
Write-Host "`n[SECURITY]" -ForegroundColor Yellow
T "SEC-001" "Tampered JWT -> 401"         "GET"  "$base/api/auth/me" $null @{Authorization="Bearer FAKE.PAYLOAD.SIGNATURE"} 401
T "SEC-002" "SQL inject in search -> 200" "GET"  "$base/api/suppliers?search=%27+OR+1%3D1+--" $null $AH 200
T "SEC-003" "Unknown route -> 404"        "GET"  "$base/api/nonexistent" $null $AH 404
T "SEC-004" "Purchase mgr create user->403" "POST" "$base/api/users" @{name="X";email="x@x.com";password="Test@1234";role="admin"} $PH 403

# ── REGRESSION ────────────────────────────────────────────────────────────────
Write-Host "`n[BUG REGRESSION]" -ForegroundColor Yellow
T "REG-003" "BUG-003: batches/all not shadowed" "GET" "$base/api/materials/batches/all"         $null $AH 200
T "REG-004" "BUG-004: logs/all not shadowed"     "GET" "$base/api/machines/logs/all"             $null $AH 200
T "REG-005" "BUG-005: supplier template works"   "GET" "$base/api/suppliers/export/template"     $null $AH 200
T "REG-010" "BUG-010: dispatch logs paginated"   "GET" "$base/api/finished-goods/dispatches/all" $null $AH 200
T "REG-011" "BUG-011: bad date -> 400 not 500"   "GET" "$base/api/reports/quality?from_date=BAD" $null $AH 400
T "REG-012" "BUG-012: WO invalid trans -> 400"   "PUT" "$base/api/work-orders/$woid/status" @{status="pending"} $ProdH 400

# ── SUMMARY ───────────────────────────────────────────────────────────────────
$total = $p + $f
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ("  TOTAL :  {0,3} tests" -f $total) -ForegroundColor White
Write-Host ("  PASSED:  {0,3}  PASS" -f $p) -ForegroundColor Green
Write-Host ("  FAILED:  {0,3}  FAIL" -f $f) -ForegroundColor $(if ($f -eq 0) { "Green" } else { "Red" })
Write-Host "=======================================" -ForegroundColor Cyan
if ($fl.Count -gt 0) {
    Write-Host "`nFAILED TESTS:" -ForegroundColor Red
    $fl | ForEach-Object { Write-Host "  x $_" -ForegroundColor Red }
}
