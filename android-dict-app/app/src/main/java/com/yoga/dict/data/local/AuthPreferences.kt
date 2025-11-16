package com.yoga.dict.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "auth_prefs")

@Singleton
class AuthPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        val TOKEN_KEY = stringPreferencesKey("access_token")
        val USER_ROLE_KEY = stringPreferencesKey("user_role")
        val USER_LOGIN_KEY = stringPreferencesKey("user_login")
        val IS_AUTHENTICATED_KEY = booleanPreferencesKey("is_authenticated")
    }
    
    val token: Flow<String?> = context.dataStore.data.map { it[TOKEN_KEY] }
    val userRole: Flow<String?> = context.dataStore.data.map { it[USER_ROLE_KEY] }
    val userLogin: Flow<String?> = context.dataStore.data.map { it[USER_LOGIN_KEY] }
    val isAuthenticated: Flow<Boolean> = context.dataStore.data.map { it[IS_AUTHENTICATED_KEY] ?: false }
    
    suspend fun saveToken(token: String) {
        context.dataStore.edit { it[TOKEN_KEY] = token }
    }
    
    suspend fun saveUserRole(role: String) {
        context.dataStore.edit { it[USER_ROLE_KEY] = role }
    }
    
    suspend fun saveUserLogin(login: String) {
        context.dataStore.edit { it[USER_LOGIN_KEY] = login }
    }
    
    suspend fun setAuthenticated(isAuthenticated: Boolean) {
        context.dataStore.edit { it[IS_AUTHENTICATED_KEY] = isAuthenticated }
    }
    
    suspend fun clear() {
        context.dataStore.edit {
            it.remove(TOKEN_KEY)
            it.remove(USER_ROLE_KEY)
            it.remove(USER_LOGIN_KEY)
            it[IS_AUTHENTICATED_KEY] = false
        }
    }
    
    suspend fun getTokenSync(): String? {
        return token.first()
    }
}

