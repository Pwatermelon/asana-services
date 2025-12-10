package com.yoga.dict.ui.screens;

import android.widget.Toast;
import androidx.compose.foundation.layout.*;
import androidx.compose.material.icons.Icons;
import androidx.compose.material.icons.filled.*;
import androidx.compose.material3.*;
import androidx.compose.runtime.*;
import androidx.compose.ui.Alignment;
import androidx.compose.ui.Modifier;
import androidx.compose.ui.layout.ContentScale;
import androidx.compose.ui.text.font.FontWeight;
import androidx.compose.ui.text.style.TextOverflow;
import coil.request.ImageRequest;
import com.yoga.dict.data.model.Asana;
import com.yoga.dict.data.model.AsanaPhoto;
import com.yoga.dict.ui.viewmodel.AsanaViewModel;
import com.yoga.dict.ui.viewmodel.AsanaUiState;
import com.yoga.dict.ui.viewmodel.AuthViewModel;

@kotlin.Metadata(mv = {1, 9, 0}, k = 2, xi = 48, d1 = {"\u0000J\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010 \n\u0002\b\u0002\n\u0002\u0010$\n\u0002\u0010\u000e\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0004\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\u001a\u0090\u0001\u0010\u0000\u001a\u00020\u00012\u0006\u0010\u0002\u001a\u00020\u00032\f\u0010\u0004\u001a\b\u0012\u0004\u0012\u00020\u00030\u00052\f\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\u00030\u00052\u001a\b\u0002\u0010\u0007\u001a\u0014\u0012\u0004\u0012\u00020\t\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u00030\u00050\b2\u0006\u0010\n\u001a\u00020\u000b2\f\u0010\f\u001a\b\u0012\u0004\u0012\u00020\u00010\r2\u0012\u0010\u000e\u001a\u000e\u0012\u0004\u0012\u00020\t\u0012\u0004\u0012\u00020\u00010\u000f2\u0012\u0010\u0010\u001a\u000e\u0012\u0004\u0012\u00020\t\u0012\u0004\u0012\u00020\u00010\u000f2\b\b\u0002\u0010\u0011\u001a\u00020\u0012H\u0007\u001aH\u0010\u0013\u001a\u00020\u00012\u0006\u0010\u0014\u001a\u00020\t2\f\u0010\u0015\u001a\b\u0012\u0004\u0012\u00020\u00010\r2\u0014\b\u0002\u0010\u0010\u001a\u000e\u0012\u0004\u0012\u00020\t\u0012\u0004\u0012\u00020\u00010\u000f2\b\b\u0002\u0010\u0016\u001a\u00020\u00172\b\b\u0002\u0010\u0018\u001a\u00020\u0019H\u0007\u001aF\u0010\u001a\u001a\u00020\u00012\f\u0010\u0006\u001a\b\u0012\u0004\u0012\u00020\u00030\u00052\u0006\u0010\n\u001a\u00020\u000b2\u0012\u0010\u000e\u001a\u000e\u0012\u0004\u0012\u00020\t\u0012\u0004\u0012\u00020\u00010\u000f2\u0012\u0010\u0010\u001a\u000e\u0012\u0004\u0012\u00020\t\u0012\u0004\u0012\u00020\u00010\u000fH\u0007\u00a8\u0006\u001b"}, d2 = {"AsanaDetailContent", "", "asana", "Lcom/yoga/dict/data/model/Asana;", "allAsanas", "", "similarAsanas", "similarAsanasMap", "", "", "isExpertOrAdmin", "", "onMatchClick", "Lkotlin/Function0;", "onRemoveSimilar", "Lkotlin/Function1;", "onNavigateToAsana", "modifier", "Landroidx/compose/ui/Modifier;", "AsanaDetailScreen", "asanaId", "onBack", "viewModel", "Lcom/yoga/dict/ui/viewmodel/AsanaViewModel;", "authViewModel", "Lcom/yoga/dict/ui/viewmodel/AuthViewModel;", "SimilarAsanasSection", "app_debug"})
public final class AsanaDetailScreenKt {
    
    @kotlin.OptIn(markerClass = {androidx.compose.material3.ExperimentalMaterial3Api.class})
    @androidx.compose.runtime.Composable()
    public static final void AsanaDetailScreen(@org.jetbrains.annotations.NotNull()
    java.lang.String asanaId, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onBack, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onNavigateToAsana, @org.jetbrains.annotations.NotNull()
    com.yoga.dict.ui.viewmodel.AsanaViewModel viewModel, @org.jetbrains.annotations.NotNull()
    com.yoga.dict.ui.viewmodel.AuthViewModel authViewModel) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void AsanaDetailContent(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.model.Asana asana, @org.jetbrains.annotations.NotNull()
    java.util.List<com.yoga.dict.data.model.Asana> allAsanas, @org.jetbrains.annotations.NotNull()
    java.util.List<com.yoga.dict.data.model.Asana> similarAsanas, @org.jetbrains.annotations.NotNull()
    java.util.Map<java.lang.String, ? extends java.util.List<com.yoga.dict.data.model.Asana>> similarAsanasMap, boolean isExpertOrAdmin, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onMatchClick, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onRemoveSimilar, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onNavigateToAsana, @org.jetbrains.annotations.NotNull()
    androidx.compose.ui.Modifier modifier) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void SimilarAsanasSection(@org.jetbrains.annotations.NotNull()
    java.util.List<com.yoga.dict.data.model.Asana> similarAsanas, boolean isExpertOrAdmin, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onRemoveSimilar, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onNavigateToAsana) {
    }
}