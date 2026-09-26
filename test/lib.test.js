const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../lib.js');

test('extractVariables returns unique names in order', () => {
  assert.deepEqual(L.extractVariables('Hi {{first_name}}, {{ city }} {{first_name}} {{Property_Name}}'), ['first_name', 'city', 'property_name']);
  assert.deepEqual(L.extractVariables('no vars'), []);
});

test('renderTemplate fills values and leaves missing ones visible', () => {
  const t = 'Hey {{first_name}}, I came across {{property_name}} in {{city}}.';
  assert.equal(L.renderTemplate(t, { first_name: 'Carlos', property_name: 'Casa Libia', city: 'Medellín' }), 'Hey Carlos, I came across Casa Libia in Medellín.');
  assert.equal(L.renderTemplate(t, { first_name: ' Carlos ' }), 'Hey Carlos, I came across {{property_name}} in {{city}}.');
  assert.deepEqual(L.missingVariables(t, { first_name: 'Carlos', city: '  ' }), ['property_name', 'city']);
});

test('normalizePhone handles international formats', () => {
  assert.deepEqual(L.normalizePhone('+57 300 123 4567'), { ok: true, digits: '573001234567', error: '' });
  assert.equal(L.normalizePhone('+1 (305) 555-0199').digits, '13055550199');
  assert.equal(L.normalizePhone('0057 300 123 4567').digits, '573001234567');
  assert.equal(L.normalizePhone('573001234567').digits, '573001234567');
});

test('normalizePhone applies the default country code', () => {
  assert.equal(L.normalizePhone('300 123 4567', '57').digits, '573001234567');
  assert.equal(L.normalizePhone('573001234567', '57').digits, '573001234567');
  assert.equal(L.normalizePhone('07700 900123', '44').digits, '447700900123');
  assert.equal(L.normalizePhone('+44 7700 900123', '57').digits, '447700900123');
});

test('normalizePhone rejects ambiguous or invalid numbers', () => {
  assert.equal(L.normalizePhone('300 123 4567').ok, false);
  assert.equal(L.normalizePhone('+57 12').ok, false);
  assert.equal(L.normalizePhone('+1234567890123456').ok, false);
  assert.equal(L.normalizePhone('').ok, false);
});

test('buildWhatsAppUrl encodes the message for each mode', () => {
  const msg = 'Hey Carlos,\n\nCasa Libia & Medellín?';
  const enc = encodeURIComponent(msg);
  assert.equal(L.buildWhatsAppUrl('573001234567', msg, 'wa'), `https://wa.me/573001234567?text=${enc}`);
  assert.equal(L.buildWhatsAppUrl('573001234567', msg, 'web'), `https://web.whatsapp.com/send?phone=573001234567&text=${enc}`);
  assert.equal(L.buildWhatsAppUrl('573001234567', msg, 'app'), `whatsapp://send?phone=573001234567&text=${enc}`);
});

test('date helpers', () => {
  const base = new Date(2026, 0, 30);
  assert.equal(L.addDays(base, 3), '2026-02-02');
  assert.equal(L.daysUntil('2026-02-02', base), 3);
  assert.equal(L.daysUntil('2026-01-29', base), -1);
});

test('CSV round trip with quotes, commas and newlines', () => {
  const rows = [['Name', 'Notes'], ['Carlos', 'Villa, 6 rooms'], ['Ana', 'Said "call later"\nmaybe']];
  assert.deepEqual(L.parseCSV(L.toCSV(rows)), rows);
  assert.deepEqual(L.parseCSV('﻿a,b\r\n1,2\r\n\r\n'), [['a', 'b'], ['1', '2']]);
});

test('firstName', () => {
  assert.equal(L.firstName('  Carlos  Restrepo '), 'Carlos');
  assert.equal(L.firstName(''), '');
});

test('parseLeads reads plain lines: phone found anywhere, then property, location', () => {
  const r = L.parseLeads('Casa Libia, +57 300 123 4567, Medellín\n+57 310 555 0101, Villa Serena, Cartagena, 6 rooms, pool\nno number here');
  assert.deepEqual(r.leads, [
    { propertyName: 'Casa Libia', city: 'Medellín', phone: '573001234567' },
    { propertyName: 'Villa Serena', city: 'Cartagena', notes: '6 rooms · pool', phone: '573105550101' },
  ]);
  assert.equal(r.skipped.length, 1);
  assert.equal(r.skipped[0].reason, 'No phone number found');
  assert.equal(r.hasHeader, false);
});

test('parseLeads reads tab-separated spreadsheet rows with headers in any order', () => {
  const text = 'Location\tWhatsApp\tProperty Name\tFolder\nTulum\t+52 998 123 4567\tHotel Azul\tMexico hotels\nTulum\t998 000\tBad Number\t\n';
  const r = L.parseLeads(text);
  assert.equal(r.hasHeader, true);
  assert.deepEqual(r.leads, [{ city: 'Tulum', propertyName: 'Hotel Azul', folder: 'Mexico hotels', phone: '529981234567' }]);
  assert.equal(r.skipped.length, 1);
});

test('parseLeads applies the default country code, merges duplicates and handles semicolons', () => {
  const r = L.parseLeads('300 123 4567; Casa Libia\n+57 300 123 4567; ; Medellín', '57');
  assert.equal(r.leads.length, 1);
  assert.equal(r.leads[0].phone, '573001234567');
  assert.equal(r.leads[0].propertyName, 'Casa Libia');
  assert.equal(r.leads[0].city, 'Medellín');
});

test('looksLikePhone', () => {
  assert.equal(L.looksLikePhone('+57 (300) 123-4567'), true);
  assert.equal(L.looksLikePhone('Casa 12345678'), false);
  assert.equal(L.looksLikePhone('2024'), false);
});
