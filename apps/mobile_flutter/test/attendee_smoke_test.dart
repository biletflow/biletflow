import 'dart:convert';

import 'package:biletflow_mobile/core/api.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  test('attendee catalog, checkout simulate, tickets, and binary APIs', () async {
    final client = ApiClient(
      'https://example.test',
      client: MockClient((request) async {
        final path = request.url.path;
        final auth = request.headers['authorization'];
        expect(auth, 'Bearer attendee-token');

        if (path == '/api/events') {
          expect(request.url.queryParameters['query'], 'campus');
          return http.Response(
            jsonEncode({
              'events': [
                {
                  'id': 'evt1',
                  'slug': 'campus-night',
                  'title': 'Campus night',
                  'isFree': false,
                  'minPriceKzt': 5000,
                  'venue': {'city': 'Almaty'},
                },
              ],
              'cities': ['Almaty'],
              'categories': [],
            }),
            200,
          );
        }
        if (path == '/api/events/campus-night') {
          return http.Response(
            jsonEncode({
              'event': {
                'id': 'evt1',
                'slug': 'campus-night',
                'title': 'Campus night',
                'ticketTypes': [
                  {
                    'id': 'tt1',
                    'name': 'General',
                    'priceKzt': 5000,
                    'available': 4,
                    'maxPerOrder': 4,
                  },
                ],
              },
            }),
            200,
          );
        }
        if (path == '/api/orders' && request.method == 'POST') {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body['eventId'], 'evt1');
          expect(body['clientIdempotencyKey'], isNotEmpty);
          return http.Response(
            jsonEncode({
              'order': {
                'id': 'ord1',
                'status': 'AWAITING_PAYMENT',
                'totalKzt': 5000,
                'tickets': [],
              },
            }),
            201,
          );
        }
        if (path == '/api/orders/ord1/pay' && request.method == 'POST') {
          return http.Response(
            jsonEncode({
              'payment': {
                'id': 'pay1',
                'intentId': 'sim_1',
                'amountKzt': 5000,
                'status': 'CREATED',
              },
              'url': 'https://example.test/sandbox/pay/sim_1',
            }),
            200,
          );
        }
        if (path == '/api/orders/ord1/pay/simulate' && request.method == 'POST') {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          expect(body['outcome'], 'APPROVED');
          return http.Response(
            jsonEncode({
              'order': {
                'id': 'ord1',
                'status': 'PAID',
                'totalKzt': 5000,
                'tickets': [
                  {'id': 'tkt1', 'status': 'VALID', 'ticketTypeName': 'General'},
                ],
              },
            }),
            200,
          );
        }
        if (path == '/api/tickets') {
          return http.Response(
            jsonEncode({
              'tickets': [
                {
                  'id': 'tkt1',
                  'status': 'VALID',
                  'ticketTypeName': 'General',
                  'attendeeName': 'Demo',
                  'event': {'title': 'Campus night', 'startsAt': '2026-12-01T19:00:00.000Z'},
                },
              ],
            }),
            200,
          );
        }
        if (path == '/api/tickets/tkt1/qr.png') {
          return http.Response.bytes(
            [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
            200,
            headers: {'content-type': 'image/png'},
          );
        }
        if (path == '/api/tickets/tkt1/pdf') {
          return http.Response.bytes(
            '%PDF-'.codeUnits,
            200,
            headers: {'content-type': 'application/pdf'},
          );
        }
        fail('Unexpected ${request.method} $path');
      }),
    );
    client.token = 'attendee-token';
    addTearDown(client.close);

    final catalog = await client.get('/api/events', query: {'query': 'campus'});
    expect((catalog['events'] as List).first['slug'], 'campus-night');

    final detail = await client.get('/api/events/campus-night');
    expect(detail['event']['id'], 'evt1');

    final created = await client.post('/api/orders', {
      'eventId': 'evt1',
      'items': [
        {'ticketTypeId': 'tt1', 'quantity': 1},
      ],
      'attendees': [
        {'fullName': 'Demo Attendee', 'email': 'demo@example.test'},
      ],
      'clientIdempotencyKey': '11111111-1111-4111-8111-111111111111',
    });
    expect(created['order']['status'], 'AWAITING_PAYMENT');

    await client.post('/api/orders/ord1/pay', {});
    final settled = await client.post('/api/orders/ord1/pay/simulate', {
      'outcome': 'APPROVED',
    });
    expect(settled['order']['status'], 'PAID');

    final tickets = await client.get('/api/tickets');
    expect((tickets['tickets'] as List).first['id'], 'tkt1');

    final qr = await client.getBytes('/api/tickets/tkt1/qr.png', accept: 'image/png');
    expect(qr.take(8), [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    final pdf = await client.getBytes('/api/tickets/tkt1/pdf', accept: 'application/pdf');
    expect(String.fromCharCodes(pdf.take(5)), '%PDF-');
  });
}
