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
public final class ModerationRepository_Factory implements Factory<ModerationRepository> {
  private final Provider<DictApiService> apiServiceProvider;

  public ModerationRepository_Factory(Provider<DictApiService> apiServiceProvider) {
    this.apiServiceProvider = apiServiceProvider;
  }

  @Override
  public ModerationRepository get() {
    return newInstance(apiServiceProvider.get());
  }

  public static ModerationRepository_Factory create(Provider<DictApiService> apiServiceProvider) {
    return new ModerationRepository_Factory(apiServiceProvider);
  }

  public static ModerationRepository newInstance(DictApiService apiService) {
    return new ModerationRepository(apiService);
  }
}
