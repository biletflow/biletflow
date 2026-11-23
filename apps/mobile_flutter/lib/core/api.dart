import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final int status;
  final String code;
  const ApiException(this.status, this.code);
  @override
  String toString() => code;
}

class ApiClient {
  final Uri base;
  final http.Client _http;
  String? token;
  ApiClient(String url, {http.Client? client})
      : base = Uri.parse(url), _http = client ?? http.Client() {
    if (!base.hasAuthority || !['http', 'https'].contains(base.scheme) ||
        base.userInfo.isNotEmpty || base.hasQuery || base.hasFragment) {
      throw ArgumentError('Provide an HTTP(S) server URL');
    }
  }

  Future<Map<String, dynamic>> request(String method, String path,
      {Map<String, dynamic>? body}) async {
    if (!path.startsWith('/api/') || path.startsWith('//')) {
      throw ArgumentError('Expected a local API path');
    }
    final uri = base.resolve(path);
    if (uri.origin != base.origin || !uri.path.startsWith('/api/')) {
      throw ArgumentError('Invalid API path');
    }
    final request = http.Request(method, uri)
      ..followRedirects = false
      ..headers.addAll({'Accept': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
        if (body != null) 'Content-Type': 'application/json'});
    if (body != null) request.body = jsonEncode(body);
    final response = await http.Response.fromStream(await _http.send(request)
        .timeout(const Duration(seconds: 20))).timeout(const Duration(seconds: 20));
    Map<String, dynamic> data;
    try {
      final value = jsonDecode(response.body);
      data = value is Map<String, dynamic> ? value : {};
    } on FormatException {
      data = {};
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = data['error'];
      throw ApiException(response.statusCode,
          error is Map ? '${error['code'] ?? 'REQUEST_FAILED'}' : 'REQUEST_FAILED');
    }
    return data;
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
  }) {
    if (query == null || query.isEmpty) return request('GET', path);
    final params = <String, String>{
      for (final entry in query.entries)
        if (entry.value.isNotEmpty) entry.key: entry.value,
    };
    final suffix = params.isEmpty
        ? ''
        : '?${Uri(queryParameters: params).query}';
    return request('GET', '$path$suffix');
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) =>
      request('POST', path, body: body);
  Future<Map<String, dynamic>> put(String path, Map<String, dynamic> body) =>
      request('PUT', path, body: body);

  /// Authenticated binary download (QR PNG / PDF). Token stays in the header only.
  Future<List<int>> getBytes(String path, {String accept = '*/*'}) async {
    if (!path.startsWith('/api/') || path.startsWith('//')) {
      throw ArgumentError('Expected a local API path');
    }
    final uri = base.resolve(path);
    if (uri.origin != base.origin || !uri.path.startsWith('/api/')) {
      throw ArgumentError('Invalid API path');
    }
    final request = http.Request('GET', uri)
      ..followRedirects = false
      ..headers.addAll({
        'Accept': accept,
        if (token != null) 'Authorization': 'Bearer $token',
      });
    final response = await http.Response.fromStream(await _http
            .send(request)
            .timeout(const Duration(seconds: 30)))
        .timeout(const Duration(seconds: 30));
    if (response.statusCode < 200 || response.statusCode >= 300) {
      String code = 'REQUEST_FAILED';
      try {
        final value = jsonDecode(response.body);
        if (value is Map && value['error'] is Map) {
          code = '${value['error']['code'] ?? code}';
        }
      } catch (_) {}
      throw ApiException(response.statusCode, code);
    }
    return response.bodyBytes;
  }

  void close() => _http.close();
}
