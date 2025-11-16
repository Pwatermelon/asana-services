package com.yoga.dict.ui.viewmodel;

import com.yoga.dict.data.local.AuthPreferences;
import com.yoga.dict.data.repository.AuthRepository;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata
@QualifierMetadata
@DaggerGenerated
@Generated(
    value = "dagger.internal.codegen.ComponentProcessor",
    comments = "https://dagger.dev"
)
@SuppressWarnings({
    "unchecked",
    "rawtypes",
    "KotlinInternal",
    "KotlinInternalInJava"
})
public final class AuthViewModel_Factory implements Factory<AuthViewModel> {
  private final Provider<AuthRepository> authRepositoryProvider;

  private final Provider<AuthPreferences> authPreferencesProvider;

  public AuthViewModel_Factory(Provider<AuthRepository> authRepositoryProvider,
      Provider<AuthPreferences> authPreferencesProvider) {
    this.authRepositoryProvider = authRepositoryProvider;
    this.authPreferencesProvider = authPreferencesProvider;
  }

  @Override
  public AuthViewModel get() {
    return newInstance(authRepositoryProvider.get(), authPreferencesProvider.get());
  }

  public static AuthViewModel_Factory create(Provider<AuthRepository> authRepositoryProvider,
      Provider<AuthPreferences> authPreferencesProvider) {
    return new AuthViewModel_Factory(authRepositoryProvider, authPreferencesProvider);
  }

  public static AuthViewModel newInstance(AuthRepository authRepository,
      AuthPreferences authPreferences) {
    return new AuthViewModel(authRepository, authPreferences);
  }
}
