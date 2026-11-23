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
  bool get canScan =>
      role == 'PLATFORM_ADMIN' ||
      role == 'ORGANIZER' ||
      (user?['staffAssignments'] is List &&
          (user!['staffAssignments'] as List).whereType<Map>().any(
            (assignment) =>
                assignment['role'] == 'EVENT_ADMIN' ||
                assignment['role'] == 'CO_ORGANIZER',
          ));

  String get _key => 'biletflow_token_${api.base.origin}';
  Future<void> restore() async {
    try {
      api.token = await storage.read(key: _key);
      if (api.token != null) await refresh();
    } on ApiException catch (e) {
      if (e.status == 401 || e.status == 403) {
        try {
          await _clearSession();
        } catch (_) {
          error = 'Unable to clear the saved session';
        }
      } else {
        error = e.code;
      }
    } catch (_) {
      error = 'Unable to restore session';
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> refresh() async {
    final token = api.token;
    final profile = await _fetchProfile();
    if (api.token != token) return;
    user = profile;
    notifyListeners();
  }

  Future<Map<String, dynamic>> _fetchProfile() async {
    final result = await api.get('/api/me');
    final value = result['user'];
    if (value is! Map<String, dynamic>) {
      throw const ApiException(500, 'INVALID_USER_RESPONSE');
    }
    return value;
  }

  Future<void> login(String email, String password) async {
    api.token = null;
    error = null;
    final Map<String, dynamic> response;
    try {
      response = await api.post('/api/mobile/auth/login', {
        'email': email,
        'password': password,
      });
    } on ApiException catch (e) {
      if (e.status == 401 && e.code == 'UNAUTHENTICATED') {
        throw const ApiException(401, 'INVALID_CREDENTIALS');
      }
      rethrow;
    }
    final token = response['token'];
    if (token is! String || token.isEmpty) {
      throw const ApiException(500, 'MISSING_SESSION_TOKEN');
    }
    api.token = token;
    try {
      final profile = await _fetchProfile();
      await storage.write(key: _key, value: token);
      user = profile;
      notifyListeners();
    } catch (_) {
      api.token = null;
      user = null;
      notifyListeners();
      rethrow;
    }
  }

  Future<void> logout() async {
    if (loading) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      if (api.token != null) {
        await api.post('/api/auth/sign-out', {});
      }
    } on ApiException catch (e) {
      if (e.status != 401) error = 'Unable to revoke the server session';
    } catch (_) {
      error = 'Unable to revoke the server session';
    } finally {
      try {
        await _clearSession();
      } catch (_) {
        error = 'Unable to clear the saved session';
      } finally {
        loading = false;
        notifyListeners();
      }
    }
  }

  Future<void> _clearSession() async {
    api.token = null;
    user = null;
    await storage.delete(key: _key);
  }
}
