// Raio-X — fila de cartas (T46). Site manda o deck; o PC do Felipe busca os pedidos com a CHAVE.
// Aba "fila": ts | id | estado (novo/pegou/feito/erro) | pc | cartas | deck
function aba_() {
  var pl = SpreadsheetApp.getActiveSpreadsheet(), a = pl.getSheetByName('fila');
  if (!a) { a = pl.insertSheet('fila'); a.appendRow(['ts', 'id', 'estado', 'pc', 'cartas', 'deck']); }
  return a;
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function chaveOk_(p) { return p.chave && p.chave === CHAVE_; }

// site: POST deck=<lista> → {id}
function doPost(e) {
  var deck = String((e.parameter && e.parameter.deck) || (e.postData && e.postData.contents) || '').slice(0, 20000);
  if (deck.split('\n').length < 2) return json_({erro: 'deck vazio'});
  var trava = LockService.getScriptLock(); trava.waitLock(10000);
  try {
    var a = aba_(), hoje = new Date(), n = 0, v = a.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) if (v[i][0] && (hoje - new Date(v[i][0])) < 864e5) n++;
    if (n >= 200) return json_({erro: 'muitos pedidos hoje, tente amanhã'});
    var id = Utilities.getUuid().slice(0, 8);
    a.appendRow([hoje.toISOString(), id, 'novo', '', '', deck]);
    return json_({id: id});
  } finally { trava.releaseLock(); }
}

// GET ?acao=estado&id=…              (site, público)
// GET ?acao=pegar&pc=…&chave=…        (PC: pega o mais antigo 'novo' e marca 'pegou')
// GET ?acao=marcar&id=…&estado=feito|erro&cartas=N&chave=…
function doGet(e) {
  var p = e.parameter || {}, a = aba_(), v = a.getDataRange().getValues();
  if (p.acao === 'estado') {
    for (var i = 1; i < v.length; i++) if (v[i][1] === p.id) return json_({estado: v[i][2], cartas: v[i][4]});
    return json_({erro: 'não achei'});
  }
  if (!chaveOk_(p)) return json_({erro: 'chave'});
  var trava = LockService.getScriptLock(); trava.waitLock(10000);
  try {
    if (p.acao === 'pegar') {
      for (var j = 1; j < v.length; j++) if (v[j][2] === 'novo') {
        a.getRange(j + 1, 3, 1, 2).setValues([['pegou', p.pc || '?']]);
        return json_({id: v[j][1], deck: v[j][5]});
      }
      return json_({vazio: true});
    }
    if (p.acao === 'marcar') {
      for (var k = 1; k < v.length; k++) if (v[k][1] === p.id) {
        a.getRange(k + 1, 3).setValue(p.estado || 'feito'); a.getRange(k + 1, 5).setValue(p.cartas || '');
        return json_({ok: true});
      }
      return json_({erro: 'não achei'});
    }
    return json_({erro: 'acao'});
  } finally { trava.releaseLock(); }
}
