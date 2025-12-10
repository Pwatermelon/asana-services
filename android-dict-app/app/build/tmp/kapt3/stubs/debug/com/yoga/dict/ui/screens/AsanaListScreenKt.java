package com.yoga.dict.ui.screens;

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
import com.yoga.dict.ui.viewmodel.AsanaViewModel;
import com.yoga.dict.ui.viewmodel.AsanaUiState;
import com.yoga.dict.ui.viewmodel.AuthViewModel;

@kotlin.Metadata(mv = {1, 9, 0}, k = 2, xi = 48, d1 = {"\u0000T\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000b\n\u0002\b\u0003\n\u0002\u0010 \n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0011\u001a&\u0010\u0000\u001a\u00020\u00012\u0012\u0010\u0002\u001a\u000e\u0012\u0004\u0012\u00020\u0004\u0012\u0004\u0012\u00020\u00010\u00032\b\b\u0002\u0010\u0005\u001a\u00020\u0006H\u0007\u001aV\u0010\u0007\u001a\u00020\u00012\u0006\u0010\b\u001a\u00020\t2\f\u0010\n\u001a\b\u0012\u0004\u0012\u00020\u00010\u000b2\u0018\u0010\f\u001a\u0014\u0012\u0004\u0012\u00020\u000e\u0012\u0004\u0012\u00020\u000e\u0012\u0004\u0012\u00020\u00010\r2\b\b\u0002\u0010\u000f\u001a\u00020\u00102\b\b\u0002\u0010\u0011\u001a\u00020\u00102\b\b\u0002\u0010\u0005\u001a\u00020\u0006H\u0007\u001an\u0010\u0012\u001a\u00020\u00012\f\u0010\u0013\u001a\b\u0012\u0004\u0012\u00020\t0\u00142\u0012\u0010\u0015\u001a\u000e\u0012\u0004\u0012\u00020\t\u0012\u0004\u0012\u00020\u00010\u00032$\u0010\f\u001a \u0012\u0004\u0012\u00020\t\u0012\u0010\u0012\u000e\u0012\u0004\u0012\u00020\u000e\u0012\u0004\u0012\u00020\u000e0\u0016\u0012\u0004\u0012\u00020\u00010\r2\b\b\u0002\u0010\u000f\u001a\u00020\u00102\b\b\u0002\u0010\u0011\u001a\u00020\u00102\b\b\u0002\u0010\u0005\u001a\u00020\u0006H\u0007\u001a`\u0010\u0017\u001a\u00020\u00012\b\b\u0002\u0010\u0018\u001a\u00020\u00192\b\b\u0002\u0010\u001a\u001a\u00020\u001b2\u0012\u0010\u0015\u001a\u000e\u0012\u0004\u0012\u00020\t\u0012\u0004\u0012\u00020\u00010\u00032\u000e\b\u0002\u0010\u001c\u001a\b\u0012\u0004\u0012\u00020\u00010\u000b2\u000e\b\u0002\u0010\u001d\u001a\b\u0012\u0004\u0012\u00020\u00010\u000b2\u000e\b\u0002\u0010\u001e\u001a\b\u0012\u0004\u0012\u00020\u00010\u000bH\u0007\u001a\\\u0010\u001f\u001a\u00020\u00012\u0006\u0010\b\u001a\u00020\t2\u0012\u0010 \u001a\u000e\u0012\u0004\u0012\u00020\u000e\u0012\u0004\u0012\u00020\u000e0\u00162\f\u0010!\u001a\b\u0012\u0004\u0012\u00020\u00010\u000b2\f\u0010\"\u001a\b\u0012\u0004\u0012\u00020\u00010\u000b2\f\u0010#\u001a\b\u0012\u0004\u0012\u00020\u00010\u000b2\f\u0010$\u001a\b\u0012\u0004\u0012\u00020\u00010\u000bH\u0007\u001a(\u0010%\u001a\u00020\u00012\u0006\u0010&\u001a\u00020\u00042\f\u0010\'\u001a\b\u0012\u0004\u0012\u00020\u00010\u000b2\b\b\u0002\u0010\u0005\u001a\u00020\u0006H\u0007\u001a<\u0010(\u001a\u00020\u00012\u0006\u0010)\u001a\u00020\u00042\u0012\u0010*\u001a\u000e\u0012\u0004\u0012\u00020\u0004\u0012\u0004\u0012\u00020\u00010\u00032\f\u0010+\u001a\b\u0012\u0004\u0012\u00020\u00010\u000b2\b\b\u0002\u0010\u0005\u001a\u00020\u0006H\u0007\u00a8\u0006,"}, d2 = {"AlphabetBar", "", "onLetterClick", "Lkotlin/Function1;", "", "modifier", "Landroidx/compose/ui/Modifier;", "AsanaCard", "asana", "Lcom/yoga/dict/data/model/Asana;", "onClick", "Lkotlin/Function0;", "onLongPress", "Lkotlin/Function2;", "", "showSources", "", "showPhoto", "AsanaList", "asanas", "", "onAsanaClick", "Lkotlin/Pair;", "AsanaListScreen", "viewModel", "Lcom/yoga/dict/ui/viewmodel/AsanaViewModel;", "authViewModel", "Lcom/yoga/dict/ui/viewmodel/AuthViewModel;", "onNavigateToSources", "onNavigateToSettings", "onNavigateToAddAsana", "ContextMenu", "position", "onDismiss", "onShare", "onFavorite", "onViewDetails", "ErrorMessage", "message", "onRetry", "SearchBar", "query", "onQueryChange", "onClose", "app_debug"})
public final class AsanaListScreenKt {
    
    @kotlin.OptIn(markerClass = {androidx.compose.material3.ExperimentalMaterial3Api.class})
    @androidx.compose.runtime.Composable()
    public static final void AsanaListScreen(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.ui.viewmodel.AsanaViewModel viewModel, @org.jetbrains.annotations.NotNull()
    com.yoga.dict.ui.viewmodel.AuthViewModel authViewModel, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super com.yoga.dict.data.model.Asana, kotlin.Unit> onAsanaClick, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onNavigateToSources, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onNavigateToSettings, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onNavigateToAddAsana) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void AsanaList(@org.jetbrains.annotations.NotNull()
    java.util.List<com.yoga.dict.data.model.Asana> asanas, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super com.yoga.dict.data.model.Asana, kotlin.Unit> onAsanaClick, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function2<? super com.yoga.dict.data.model.Asana, ? super kotlin.Pair<java.lang.Integer, java.lang.Integer>, kotlin.Unit> onLongPress, boolean showSources, boolean showPhoto, @org.jetbrains.annotations.NotNull()
    androidx.compose.ui.Modifier modifier) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void AsanaCard(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.model.Asana asana, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onClick, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function2<? super java.lang.Integer, ? super java.lang.Integer, kotlin.Unit> onLongPress, boolean showSources, boolean showPhoto, @org.jetbrains.annotations.NotNull()
    androidx.compose.ui.Modifier modifier) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void SearchBar(@org.jetbrains.annotations.NotNull()
    java.lang.String query, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onQueryChange, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onClose, @org.jetbrains.annotations.NotNull()
    androidx.compose.ui.Modifier modifier) {
    }
    
    @kotlin.OptIn(markerClass = {androidx.compose.material3.ExperimentalMaterial3Api.class})
    @androidx.compose.runtime.Composable()
    public static final void AlphabetBar(@org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function1<? super java.lang.String, kotlin.Unit> onLetterClick, @org.jetbrains.annotations.NotNull()
    androidx.compose.ui.Modifier modifier) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void ErrorMessage(@org.jetbrains.annotations.NotNull()
    java.lang.String message, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onRetry, @org.jetbrains.annotations.NotNull()
    androidx.compose.ui.Modifier modifier) {
    }
    
    @androidx.compose.runtime.Composable()
    public static final void ContextMenu(@org.jetbrains.annotations.NotNull()
    com.yoga.dict.data.model.Asana asana, @org.jetbrains.annotations.NotNull()
    kotlin.Pair<java.lang.Integer, java.lang.Integer> position, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onDismiss, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onShare, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onFavorite, @org.jetbrains.annotations.NotNull()
    kotlin.jvm.functions.Function0<kotlin.Unit> onViewDetails) {
    }
}