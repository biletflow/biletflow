import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:biletflow_mobile/core/api.dart';

void main() {
  test('API sends bearer token and parses response', () async {
    final client = ApiClient('https://example.test', client: MockClient((request) async {
      expect(request.url.path, '/api/me');
      expect(request.headers['authorization'], 'Bearer test-token');
      return http.Response('{"user":{"role":"ORGANIZER"}}', 200);
    }));
    client.token = 'test-token';
    expect((await client.get('/api/me'))['user']['role'], 'ORGANIZER');
    client.close();
  });
  test('API rejects forbidden responses', () async {
    final client = ApiClient('https://example.test', client: MockClient((request) async => http.Response('{"error":{"code":"FORBIDDEN"}}', 403)));
    await expectLater(client.get('/api/me'), throwsA(isA<ApiException>().having((e) => e.status, 'status', 403)));
    client.close();
  });
  test('API rejects external paths', () async {
    final client = ApiClient('https://example.test');
    await expectLater(client.get('//other.test/api/me'), throwsArgumentError);
    client.close();
  });
}
