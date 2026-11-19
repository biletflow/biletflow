import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api.dart';

class Session extends ChangeNotifier {
  final ApiClient api;
  final FlutterSecureStorage storage;
  Session(this.api, {this.storage = const FlutterSecureStorage()});
  Map<String, dynamic>? user;
  bool loading = true;
  String? error;
  String get role => '${user?['role'] ?? ''}';
  bool get canScan => role == 'PLATFORM_ADMIN' || role == 'ORGANIZER' ||
      (user?['staffAssignments'] is List && (user!['staffAssignments'] as List).isNotEmpty);

  String get _key => 'biletflow_token_${api.base.origin}';
  Future<void> restore() async {
    try {
      api.token = await storage.read(key: _key);
      if (api.token != null) await refresh();
    } on ApiException catch (e) {
      if (e.status == 401 || e.status == 403) {
        await logout();
      } else { error = e.code; }
    } catch (_) { error = 'Unable to restore session'; }
    finally { loading = false; notifyListeners(); }
  }

  Future<void> refresh() async {
    final result = await api.get('/api/me');
    final value = result['user'];
    if (value is! Map<String, dynamic>) throw const ApiException(500, 'INVALID_USER_RESPONSE');
    user = value;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    api.token = null;
    error = null;
    final response = await api.post('/api/mobile/auth/login', {'email': email, 'password': password});
    final token = response['token'];
    if (token is! String || token.isEmpty) throw const ApiException(500, 'MISSING_SESSION_TOKEN');
    api.token = token;
    try {
      final result = await api.get('/api/me');
      final value = result['user'];
      if (value is! Map<String, dynamic>) throw const ApiException(500, 'INVALID_USER_RESPONSE');
      await storage.write(key: _key, value: token);
      user = value;
      notifyListeners();
    } catch (_) {
      api.token = null; user = null; notifyListeners(); rethrow;
    }
  }

  Future<void> logout() async {
    api.token = null; user = null;
    try {
      await storage.delete(key: _key);
    } finally {
      notifyListeners();
    }
  }
}
