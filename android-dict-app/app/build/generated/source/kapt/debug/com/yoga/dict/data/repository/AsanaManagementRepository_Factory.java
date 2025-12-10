package com.yoga.dict.data.repository;

import com.yoga.dict.data.api.DictApiService;
import dagger.internal.DaggerGenerated;
import dagger.internal.Factory;
import dagger.internal.QualifierMetadata;
import dagger.internal.ScopeMetadata;
import javax.annotation.processing.Generated;
import javax.inject.Provider;

@ScopeMetadata("javax.inject.Singleton")
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
public final class AsanaManagementRepository_Factory implements Factory<AsanaManagementRepository> {
  private final Provider<DictApiService> apiServiceProvider;

  public AsanaManagementRepository_Factory(Provider<DictApiService> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public AsanaManagementRepository get() {
    return newInstance(apiServiceProvider.get());
  }

  public static AsanaManagementRepository_Factory create(
      Provider<DictApiService> apiServiceProvider) {
    return new AsanaManagementRepository_Factory(apiServiceProvider);
  }

  public static AsanaManagementRepository newInstance(DictApiService apiService) {
    return new AsanaManagementRepository(apiService);
  }
}
